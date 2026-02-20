const { Item } = require("../models/item");
const crypto = require("crypto");
const QRCode = require("qrcode");
const mongoose = require("mongoose");
const MediaRequest = require("../models/media");
const { deleteFileSafe } = require("../functions/commons");
const path = require("path");


exports.createItemWithQr = async (req, res) => {
    try {
        const {
            title,
            description,
            price,
            currency,
            category,
            format,
            tags,
            isPublished,
        } = req.body;

        if (!["physical", "digital", "service"].includes(format)) {
            return res.status(400).json({
                message: "Invalid format"
            });
        }

        let formattedTags = [];
        if (tags) {
            formattedTags = Array.isArray(tags)
                ? tags
                : tags.split(",");

            formattedTags = formattedTags.map(tag =>
                tag.trim().toLowerCase()
            );
        }

        const publicToken = crypto.randomBytes(16).toString("hex");

        const media = [];

        if (req.files?.mediaPhoto) {
            req.files.mediaPhoto.forEach(file => {
                media.push({
                    type: "image",
                    filename: file.filename
                });
            });
        }

        if (req.files?.mediaVideo) {
            req.files.mediaVideo.forEach(file => {
                media.push({
                    type: "video",
                    filename: file.filename
                });
            });
        }

        if (req.files?.mediaAudio) {
            req.files.mediaAudio.forEach(file => {
                media.push({
                    type: "audio",
                    filename: file.filename
                });
            });
        }

        if (req.files?.mediaDocument) {
            req.files.mediaDocument.forEach(file => {
                media.push({
                    type: "document",
                    filename: file.filename
                });
            });
        }

        let categories = [];

        if (Array.isArray(category)) {
            categories = category;
        } else if (typeof category === "string") {
            try {
                // Try parsing as JSON first
                const parsed = JSON.parse(category);
                if (Array.isArray(parsed)) {
                    categories = parsed;
                } else {
                    categories = [category];
                }
            } catch (err) {
                // Fallback: comma separated string
                categories = category
                    .split(",")
                    .map(id => id.trim())
                    .filter(Boolean);
            }
        }

        if (!categories.length) {
            return res.status(400).json({
                message: "At least one category is required"
            });
        }

        const invalidIds = categories.filter(
            id => !mongoose.Types.ObjectId.isValid(id)
        );

        if (invalidIds.length) {
            return res.status(400).json({
                message: "Invalid category id(s)",
                invalidIds
            });
        }


        const item = await Item.create({
            seller: req.user._id,
            category: categories,
            title,
            description,
            price,
            currency,
            format,
            tags: formattedTags,
            media,
            isPublished,
            publicToken
        });

        const publicUrl = `${process.env.PUBLIC_BASE_URL}/item/${publicToken}`;

        const qrCode = await QRCode.toDataURL(publicUrl);

        res.status(201).json({
            message: "Item created successfully",
            data: {
                itemId: item._id,
                publicToken,
                publicUrl,
                qrCode
            }
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to create item",
            error: error.message
        });
    }
};

exports.getMyItems = async (req, res) => {
    try {
        if (!["seller", "both"].includes(req.user.role)) {
            return res.status(403).json({
                message: "Only sellers can access this resource"
            });
        }

        const {
            page = 1,
            limit = 10,
            isActive,
            format,
            search
        } = req.query;

        const query = {
            seller: req.user._id
        };

        if (isActive !== undefined) {
            query.isActive = isActive === "true";
        }

        if (format) {
            if (!["physical", "digital", "service"].includes(format)) {
                return res.status(400).json({
                    message: "Invalid format"
                });
            }
            query.format = format;
        }

        if (search) {
            query.$or = [
                { title: { $regex: search, $options: "i" } },
                { tags: { $regex: search, $options: "i" } }
            ];
        }

        const skip = (Number(page) - 1) * Number(limit);

        const [items, total] = await Promise.all([
            Item.find({ ...query, isDeleted: false })
                .populate("category", "title")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(Number(limit)),

            Item.countDocuments(query)
        ]);

        res.status(200).json({
            message: "My items fetched successfully",
            meta: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit))
            },
            data: items
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch items",
            error: error.message
        });
    }
};

exports.getItemById = async (req, res) => {
    try {
        const { itemId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({
                message: "Invalid item id"
            });
        }

        const item = await Item.findById({
            _id: itemId,
            isDeleted: false
        })
            .populate("category", "title")
            .populate("seller", "firstName lastName profilePic");


        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }
        if (
            item.isActive === false &&
            req.user.role === "buyer"
        ) {
            return res.status(403).json({
                message: "This item is not available"
            });
        }

        res.status(200).json({
            message: "Item fetched successfully",
            data: item
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch item",
            error: error.message
        });
    }
};

exports.updateItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        const item = await Item.findOne({
            _id: itemId,
            seller: req.user._id
        });

        if (!item) {
            return res.status(404).json({
                message: "Item not found or unauthorized"
            });
        }

        const {
            title,
            description,
            price,
            currency,
            format,
            tags,
            category,
            isPublished,
            deleteMedia
        } = req.body;

        if (format && !["physical", "digital", "service"].includes(format)) {
            return res.status(400).json({ message: "Invalid format" });
        }

        if (tags !== undefined) {
            const formattedTags = Array.isArray(tags)
                ? tags
                : tags.split(",");

            item.tags = formattedTags.map(t => t.trim().toLowerCase());
        }

        if (category !== undefined) {
            const categories = Array.isArray(category)
                ? category
                : category.split(",").map(id => id.trim()).filter(Boolean);

            if (!categories.length) {
                return res.status(400).json({
                    message: "At least one category is required"
                });
            }

            const invalidIds = categories.filter(
                id => !mongoose.Types.ObjectId.isValid(id)
            );

            if (invalidIds.length) {
                return res.status(400).json({
                    message: "Invalid category id(s)",
                    invalidIds
                });
            }

            item.category = categories;
        }

        if (title !== undefined) item.title = title;
        if (description !== undefined) item.description = description;
        if (price !== undefined) item.price = price;
        if (currency !== undefined) item.currency = currency;
        if (format !== undefined) item.format = format;
        if (isPublished !== undefined) item.isPublished = isPublished;

        if (deleteMedia) {
            const mediaIds = Array.isArray(deleteMedia)
                ? deleteMedia
                : [deleteMedia];

            const validMediaIds = mediaIds.filter(id =>
                mongoose.Types.ObjectId.isValid(id)
            );

            const mediaToDelete = item.media.filter(m =>
                validMediaIds.includes(m._id.toString())
            );

            mediaToDelete.forEach(m => {
                const filePath = path.join(
                    __dirname,
                    "..",
                    "uploads",
                    m.filename
                );
                deleteFileSafe(filePath);
            });

            item.media = item.media.filter(
                m => !validMediaIds.includes(m._id.toString())
            );
        }

        if (req.files && Object.keys(req.files).length > 0) {
            const newMedia = [];

            if (req.files.mediaPhoto) {
                req.files.mediaPhoto.forEach(file => {
                    newMedia.push({
                        type: "image",
                        filename: file.filename
                    });
                });
            }

            if (req.files.mediaVideo) {
                req.files.mediaVideo.forEach(file => {
                    newMedia.push({
                        type: "video",
                        filename: file.filename
                    });
                });
            }

            if (req.files.mediaAudio) {
                req.files.mediaAudio.forEach(file => {
                    newMedia.push({
                        type: "audio",
                        filename: file.filename
                    });
                });
            }

            if (req.files.mediaDocument) {
                req.files.mediaDocument.forEach(file => {
                    newMedia.push({
                        type: "document",
                        filename: file.filename
                    });
                });
            }

            item.media.push(...newMedia);
        }

        await item.save();

        res.status(200).json({
            message: "Item updated successfully",
            data: {
                itemId: item._id,
                mediaCount: item.media.length
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to update item",
            error: error.message
        });
    }
};


exports.softDeleteItem = async (req, res) => {
    try {
        const { itemId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(itemId)) {
            return res.status(400).json({
                message: "Invalid item id"
            });
        }

        const item = await Item.findById(itemId);

        if (!item) {
            return res.status(404).json({
                message: "Item not found"
            });
        }

        if (
            req.user.role === "seller" &&
            item.seller.toString() !== req.user._id.toString()
        ) {
            return res.status(403).json({
                message: "You are not allowed to delete this item"
            });
        }

        item.isActive = false;
        item.isDeleted = true;
        await item.save();

        res.status(200).json({
            message: "Item deleted successfully",
            data: {
                itemId: item._id,
                isActive: item.isActive
            }
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to delete item",
            error: error.message
        });
    }
};


exports.getIncomingMediaRequests = async (req, res) => {
    try {
        const sellerId = req.user._id;

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        const search = req.query.search?.trim();

        const filter = {
            seller: sellerId
        };

        if (search) {
            filter.$or = [
                { description: { $regex: search, $options: "i" } },
                { contentType: { $regex: search, $options: "i" } }
            ];
        }

        const [requests, total] = await Promise.all([
            MediaRequest.find(filter)
                .populate("buyer", "firstName lastName profilePic")
                .populate("categories", "title")
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(),

            MediaRequest.countDocuments(filter)
        ]);

        res.status(200).json({
            message: "Incoming media requests fetched",
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            },
            data: requests
        });

    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch incoming media requests",
            error: error.message
        });
    }
};


exports.updateMediaRequestStatus = async (req, res) => {
    try {
        const sellerId = req.user._id;
        const { requestId } = req.params;
        const { status, sellerResponse } = req.body;

        if (!["approved", "rejected"].includes(status)) {
            return res.status(400).json({
                message: "Invalid status. Only approved or rejected is allowed",
            });
        }

        const request = await MediaRequest.findById(requestId);

        if (!request) {
            return res.status(404).json({
                message: "Request not found",
            });
        }

        if (request.seller.toString() !== sellerId.toString()) {
            return res.status(403).json({
                message: "You are not authorized to update this request",
            });
        }

        if (
            request.status === "pending" &&
            request.expiresAt &&
            request.expiresAt < new Date()
        ) {
            request.status = "expired";
            await request.save();

            return res.status(400).json({
                message: "This request has expired",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                message: `Request is already ${request.status}`,
            });
        }

        request.status = status;
        request.sellerResponse = sellerResponse?.trim() || undefined;

        await request.save();

        return res.status(200).json({
            message: `Request ${status} successfully`,
            data: request,
        });
    } catch (error) {
        console.error("update-media-request-status-error:", error);
        return res.status(500).json({
            message: "Failed to update request",
            error: error.message,
        });
    }
};


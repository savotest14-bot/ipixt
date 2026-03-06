const { Item, ItemView, ItemClick, ItemPurchase } = require("../models/item");
const ItemComment = require("../models/ItemComment");
const ItemLike = require("../models/ItemLike");
const UserFollow = require("../models/UserFollow");
const User = require("../models/users");
const mongoose = require("mongoose");
const MediaRequest = require("../models/media");
const CommissionTransaction = require("../models/CommissionTransaction");

exports.getItemsForBuyer = async (req, res) => {
  try {
    const userId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const buyer = await User.findById(userId)
      .select("category subCategories")
      .lean();

    if (!buyer || !buyer.category) {
      return res.status(200).json({
        message: "No category selected by buyer",
        pagination: { total: 0, page, limit, totalPages: 0 },
        data: []
      });
    }

    const matchFilter = {
      category: buyer.category,
      isActive: true,
      isDeleted: false,
      isPublished: true,
      seller: { $ne: userId }
    };

    if (buyer.subCategories?.length) {
      matchFilter.subCategories = { $in: buyer.subCategories };
    }

    if (search) {
      matchFilter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const items = await Item.aggregate([
      { $match: matchFilter },

      { $sort: { createdAt: -1 } },

      { $skip: skip },
      { $limit: limit },

      {
        $lookup: {
          from: "users",
          localField: "seller",
          foreignField: "_id",
          pipeline: [
            {
              $project: {
                firstName: 1,
                lastName: 1,
                profilePic: 1
              }
            }
          ],
          as: "seller"
        }
      },
      { $unwind: "$seller" },

      {
        $lookup: {
          from: "categories",
          localField: "category",
          foreignField: "_id",
          as: "category"
        }
      },
      { $unwind: "$category" },

      {
        $lookup: {
          from: "subcategories",
          localField: "subCategories",
          foreignField: "_id",
          as: "subCategories"
        }
      },

      // last 3 liked users
      {
        $lookup: {
          from: "itemlikes",
          let: { itemId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$item", "$$itemId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 3 },
            {
              $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                pipeline: [
                  {
                    $project: {
                      firstName: 1,
                      lastName: 1,
                      profilePic: 1
                    }
                  }
                ],
                as: "user"
              }
            },
            { $unwind: "$user" },
            { $replaceRoot: { newRoot: "$user" } }
          ],
          as: "likedUsers"
        }
      },

      // buyer liked
      {
        $lookup: {
          from: "itemlikes",
          let: { itemId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$item", "$$itemId"] },
                    { $eq: ["$user", userId] }
                  ]
                }
              }
            }
          ],
          as: "buyerLike"
        }
      },

      {
        $lookup: {
          from: "itemfavorites",
          let: { itemId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$item", "$$itemId"] },
                    { $eq: ["$user", userId] }
                  ]
                }
              }
            }
          ],
          as: "buyerFavorite"
        }
      },

      {
        $lookup: {
          from: "itemcomments",
          let: { itemId: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$item", "$$itemId"] },
                    { $eq: ["$user", userId] }
                  ]
                }
              }
            }
          ],
          as: "buyerComment"
        }
      },

      {
        $addFields: {
          isLiked: { $gt: [{ $size: "$buyerLike" }, 0] },
          isFavorited: { $gt: [{ $size: "$buyerFavorite" }, 0] },
          hasCommented: { $gt: [{ $size: "$buyerComment" }, 0] }
        }
      },

      {
        $project: {
          buyerLike: 0,
          buyerFavorite: 0,
          buyerComment: 0,
          purchasesCount: 0
        }
      }
    ]);

    const total = await Item.countDocuments(matchFilter);

    res.status(200).json({
      message: "Items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
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

exports.getLatestItemsForBuyer = async (req, res) => {
  try {
    const userId = req.user._id;

    const buyer = await User.findById(userId)
      .select("address")
      .lean();

    if (!buyer?.address?.latitude || !buyer?.address?.longitude) {
      return res.status(400).json({
        message: "Buyer location not found"
      });
    }

    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const pipeline = [
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [
              buyer.address.longitude,
              buyer.address.latitude
            ]
          },
          distanceField: "distance",
          spherical: true,
          maxDistance: 50 * 1000,
          query: {
            isDeleted: false,
            _id: { $ne: userId }
          }
        }
      },

      {
        $lookup: {
          from: "items",
          localField: "_id",
          foreignField: "seller",
          as: "items"
        }
      },

      {
        $unwind: "$items"
      },

      {
        $match: {
          "items.isActive": true,
          "items.isPublished": true,
          "items.isDeleted": false
        }
      },

      ...(search
        ? [{
          $match: {
            $or: [
              { "items.title": { $regex: search, $options: "i" } },
              { "items.description": { $regex: search, $options: "i" } },
              { "items.tags": { $regex: search, $options: "i" } }
            ]
          }
        }]
        : []),

      {
        $lookup: {
          from: "categories",
          localField: "items.category",
          foreignField: "_id",
          as: "category"
        }
      },

      {
        $lookup: {
          from: "subcategories",
          localField: "items.subCategories",
          foreignField: "_id",
          as: "subCategories"
        }
      },

      {
        $addFields: {
          category: { $arrayElemAt: ["$category", 0] }
        }
      },

      {
        $project: {
          _id: "$items._id",
          title: "$items.title",
          description: "$items.description",
          price: "$items.price",
          media: { $ifNull: ["$items.media", []] },
          createdAt: "$items.createdAt",
          distance: { $round: ["$distance", 0] },

          category: {
            _id: "$category._id",
            title: "$category.title"
          },

          subCategories: {
            $map: {
              input: "$subCategories",
              as: "sub",
              in: {
                _id: "$$sub._id",
                title: "$$sub.title"
              }
            }
          },

          seller: {
            _id: "$_id",
            firstName: "$firstName",
            lastName: "$lastName",
            profilePic: "$profilePic"
          }
        }
      },

      {
        $sort: {
          distance: 1,
          createdAt: -1
        }
      },

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [{ $skip: skip }, { $limit: limit }]
        }
      }
    ];

    const result = await User.aggregate(pipeline);

    const total = result[0]?.metadata[0]?.total || 0;

    return res.status(200).json({
      message: "Nearby items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: result[0]?.data || []
    });

  } catch (error) {
    console.error("getLatestItemsForBuyer error:", error);

    return res.status(500).json({
      message: "Failed to fetch latest items",
      error: error.message
    });
  }
};

exports.getItemComments = async (req, res) => {
  try {
    const { itemId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(itemId)
      .select("isActive isDeleted isPublished");

    if (!item || item.isDeleted) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (!item.isActive || !item.isPublished) {
      return res.status(403).json({
        message: "Item is not available"
      });
    }

    const [comments, total] = await Promise.all([
      ItemComment.find({
        item: itemId,
        isDeleted: false
      })
        .populate("user", "firstName lastName profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      ItemComment.countDocuments({
        item: itemId,
        isDeleted: false
      })
    ]);

    res.status(200).json({
      message: "Comments fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: comments
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch comments",
      error: error.message
    });
  }
};

exports.getItemById = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({
        message: "Invalid item id"
      });
    }

    const item = await Item.findOne({
      _id: itemId,
      isActive: true,
      isDeleted: false
    })
      .populate("category", "title")
       .populate("subCategories", "title")
      .populate("seller", "firstName lastName profilePic")
      .lean();

    if (!item) {
      return res.status(404).json({
        message: "Item not found"
      });
    }

    if (item.isActive === false && (req.user.role === "buyer" || req.user.role === "both")) {
      return res.status(403).json({
        message: "This item is not available"
      });
    }

    const isSeller =
      userId && item.seller._id.toString() === userId.toString();

    if (userId && !isSeller) {
      const clickExists = await ItemClick.findOne({
        item: itemId,
        user: userId
      });

      if (!clickExists) {
        await ItemClick.create({
          item: itemId,
          user: userId
        });

        await Item.findByIdAndUpdate(itemId, {
          $inc: { clicksCount: 1 }
        });
      }

      const viewExists = await ItemView.findOne({
        item: itemId,
        user: userId
      });

      if (!viewExists) {
        await ItemView.create({
          item: itemId,
          user: userId
        });

        await Item.findByIdAndUpdate(itemId, {
          $inc: { viewsCount: 1 }
        });
      }
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


exports.addComment = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { comment } = req.body;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    if (!comment || !comment.trim()) {
      return res.status(400).json({ message: "Comment is required" });
    }

    const item = await Item.findById(itemId).select("seller isActive isDeleted isPublished");

    if (!item || item.isDeleted) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (!item.isActive || !item.isPublished) {
      return res.status(403).json({ message: "Item is not available" });
    }

    if (item.seller.toString() === userId.toString()) {
      return res.status(403).json({
        message: "Seller cannot comment on own item"
      });
    }

    await ItemComment.create({
      item: itemId,
      user: userId,
      comment
    });

    await Item.findByIdAndUpdate(itemId, {
      $inc: { commentsCount: 1 }
    });

    res.status(201).json({
      message: "Comment added successfully"
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to add comment",
      error: error.message
    });
  }
};

exports.toggleLike = async (req, res) => {
  try {
    const { itemId } = req.params;
    const userId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid item id" });
    }

    const item = await Item.findById(itemId).select("seller isActive isDeleted isPublished");

    if (!item || item.isDeleted) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (!item.isActive || !item.isPublished) {
      return res.status(403).json({ message: "Item is not available" });
    }

    if (item.seller.toString() === userId.toString()) {
      return res.status(403).json({
        message: "Seller cannot like own item"
      });
    }

    const liked = await ItemLike.findOne({
      item: itemId,
      user: userId
    });

    if (liked) {
      await ItemLike.deleteOne({ _id: liked._id });

      await Item.findByIdAndUpdate(itemId, {
        $inc: { likesCount: -1 }
      });

      return res.status(200).json({
        message: "Item unliked",
        status: "unliked"
      });
    } else {
      await ItemLike.create({
        item: itemId,
        user: userId
      });

      await Item.findByIdAndUpdate(itemId, {
        $inc: { likesCount: 1 }
      });

      return res.status(200).json({
        message: "Item liked",
        status: "liked"
      });
    }

  } catch (error) {
    res.status(500).json({
      message: "Failed to like item",
      error: error.message
    });
  }
};

const crypto = require("crypto");
const calculateCommission = require("../utils/calculateCommission");
const ItemFavorite = require("../models/ItemFavorite");

exports.generateItemShareLink = async (req, res) => {
  try {
    const { itemId } = req.params;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    if (!item.publicToken) {
      item.publicToken = crypto.randomBytes(16).toString("hex");
      await item.save();
    }

    const publicUrl = `${process.env.PUBLIC_BASE_URL}/item/${item.publicToken}`;

    return res.status(200).json({
      shareUrl: publicUrl,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to generate share link",
    });
  }
};



exports.getUserProfileSummary = async (req, res) => {
  try {
    const profileUserId = req.params.userId;
    const currentUserId = req.user._id;

    if (!mongoose.Types.ObjectId.isValid(profileUserId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const user = await User.findOne({
      _id: profileUserId,
      isDeleted: false
    }).select(
      "firstName lastName profilePic followersCount followingCount role"
    ).lean();

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const [totalItems, earningsAgg] = await Promise.all([
      Item.countDocuments({
        seller: profileUserId,
        isDeleted: false,
        isActive: true
      }),

      ItemPurchase.aggregate([
        {
          $match: { user: profileUserId }
        },
        {
          $group: {
            _id: null,
            totalEarnings: { $sum: "$amount" }
          }
        }
      ])
    ]);

    const totalEarnings = earningsAgg[0]?.totalEarnings || 0;

    let isFollowing = false;
    let followsYou = false;

    if (profileUserId.toString() !== currentUserId.toString()) {
      [isFollowing, followsYou] = await Promise.all([
        UserFollow.exists({
          follower: currentUserId,
          following: profileUserId
        }),
        UserFollow.exists({
          follower: profileUserId,
          following: currentUserId
        })
      ]);
    }

    res.status(200).json({
      message: "Profile summary fetched successfully",
      data: {
        ...user,
        totalItems,
        totalEarnings,
        isFollowing: Boolean(isFollowing),
        followsYou: Boolean(followsYou),
        isOwnProfile:
          profileUserId.toString() === currentUserId.toString()
      }
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch profile summary",
      error: error.message
    });
  }
};

exports.getUserItems = async (req, res) => {
  try {
    const { userId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [items, total] = await Promise.all([
      Item.find({
        seller: userId,
        isDeleted: false,
        isActive: true,
        isPublished: true
      })
        .select("media title price likesCount commentsCount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Item.countDocuments({
        seller: userId,
        isDeleted: false,
        isActive: true,
        isPublished: true
      })
    ]);

    res.status(200).json({
      message: "User items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: items
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch user items",
      error: error.message
    });
  }
};

exports.getUserCollections = async (req, res) => {
  try {
    const { userId } = req.params;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user id" });
    }

    const [items, total] = await Promise.all([
      Item.find({
        seller: userId,
        isDeleted: false,
        isActive: true,
        isPublished: false
      })
        .select("media title price likesCount commentsCount")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Item.countDocuments({
        seller: userId,
        isDeleted: false,
        isActive: true,
        isPublished: false
      })
    ]);

    res.status(200).json({
      message: "User items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: items
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch user items",
      error: error.message
    });
  }
};


exports.requestMedia = async (req, res) => {
  try {
    const buyerId = req.user._id;

    const {
      sellerId,
      title,
      price,
      contentType,
      category,
      subCategories,
      locationType,
      scheduledAt,
      description
    } = req.body;

    if (
      !sellerId ||
      !title ||
      price === undefined ||
      !contentType ||
      !category ||
      !scheduledAt
    ) {
      return res.status(400).json({
        message: "All required fields must be provided"
      });
    }

    if (buyerId.toString() === sellerId.toString()) {
      return res.status(403).json({
        message: "You cannot request media from yourself"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(category)) {
      return res.status(400).json({
        message: "Invalid category id"
      });
    }

    if (subCategories && !Array.isArray(subCategories)) {
      return res.status(400).json({
        message: "subCategories must be an array"
      });
    }

    if (subCategories?.length) {
      const invalidIds = subCategories.filter(
        id => !mongoose.Types.ObjectId.isValid(id)
      );

      if (invalidIds.length) {
        return res.status(400).json({
          message: "Invalid subCategory id(s)",
          invalidIds
        });
      }
    }

    if (new Date(scheduledAt) < new Date()) {
      return res.status(400).json({
        message: "Scheduled date must be in the future"
      });
    }

    const seller = await User.findById(sellerId).select("_id isDeleted");

    if (!seller || seller.isDeleted) {
      return res.status(404).json({
        message: "Seller not found"
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const commissionData = await calculateCommission(
      price,
      "requestPurchaseCommission"
    );

    const requestCharge = commissionData.commissionAmount;

    const request = await MediaRequest.create({
      buyer: buyerId,
      seller: sellerId,
      title,
      price,
      contentType,
      category,
      subCategories,
      locationType,
      requestCharge,
      scheduledAt,
      description,
      expiresAt,
      isPaid: false
    });

    await CommissionTransaction.create({
      commissionType: "request_purchase",
      commissionSource: "media_request",
      sourceId: request._id,
      buyer: buyerId,
      seller: sellerId,
      baseAmount: price,
      commissionAmount: requestCharge,
      commissionConfig: {
        type: commissionData.type,
        value: commissionData.value
      },
      status: "pending"
    });

    return res.status(201).json({
      message: "Media request sent successfully",
      data: request
    });

  } catch (error) {
    console.error("request-media-error:", error);

    return res.status(500).json({
      message: "Failed to request media",
      error: error.message
    });
  }
};


exports.getMyMediaRequests = async (req, res) => {
  try {
    const buyerId = req.user._id;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search?.trim();

    const filter = {
      buyer: buyerId
    };

    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: "i" } },
        { contentType: { $regex: search, $options: "i" } }
      ];
    }

    const [requests, total] = await Promise.all([
      MediaRequest.find(filter)
        .populate("seller", "firstName lastName profilePic")
         .populate("subCategories", "title")
        .populate("category", "title")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      MediaRequest.countDocuments(filter)
    ]);

    res.status(200).json({
      message: "My media requests fetched",
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
      message: "Failed to fetch media requests",
      error: error.message
    });
  }
};


exports.confirmPurchase = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      buyerId,
      sellerId,
      itemId,
      amount,
      paymentMethod,
      paymentId
    } = req.body;

    const COMMISSION_PERCENT = 10;
    const commission = (amount * COMMISSION_PERCENT) / 100;
    const sellerEarning = amount - commission;

    const order = await Order.create([{
      buyer: buyerId,
      seller: sellerId,
      item: itemId,
      amountPaid: amount,
      commissionAmount: commission,
      sellerEarning,
      paymentMethod,
      paymentId
    }], { session });

    await WalletTransaction.create([{
      seller: sellerId,
      type: "sale",
      amount: sellerEarning,
      direction: "credit",
      referenceId: order[0]._id,
      paymentId
    }], { session });

    await SellerWallet.findOneAndUpdate(
      { seller: sellerId },
      { $inc: { balance: sellerEarning } },
      { upsert: true, session }
    );

    await session.commitTransaction();

    res.status(200).json({
      message: "Purchase successful",
      orderId: order[0]._id
    });

  } catch (error) {
    await session.abortTransaction();
    res.status(500).json({
      message: "Purchase failed",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};


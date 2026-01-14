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
      .select("categories")
      .lean();

    if (!buyer || !buyer.categories?.length) {
      return res.status(200).json({
        message: "No categories selected by buyer",
        pagination: { total: 0, page, limit, totalPages: 0 },
        data: []
      });
    }

    const filter = {
      category: { $in: buyer.categories },
      isActive: true,
      isDeleted: false,
      isPublished: true,
      seller: { $ne: userId }
    };

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { tags: { $regex: search, $options: "i" } }
      ];
    }

    const [items, total] = await Promise.all([
      Item.find(filter)
        .select("-purchasesCount")
        .populate("category", "title")
        .populate("seller", "firstName lastName profilePic")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      Item.countDocuments(filter)
    ]);

    const itemIds = items.map(i => i._id);

    const [likes, favorites, comments] = await Promise.all([
      ItemLike.find({ user: userId, item: { $in: itemIds } })
        .select("item")
        .lean(),

      ItemFavorite.find({ user: userId, item: { $in: itemIds } })
        .select("item")
        .lean(),

      ItemComment.find({ user: userId, item: { $in: itemIds } })
        .select("item")
        .lean()
    ]);

    const likedUsersAgg = await ItemLike.aggregate([
      { $match: { item: { $in: itemIds } } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$item",
          users: { $push: "$user" }
        }
      },
      {
        $project: {
          users: { $slice: ["$users", 3] }
        }
      }
    ]);

    const likedUserIds = [
      ...new Set(likedUsersAgg.flatMap(l => l.users))
    ];

    const usersMap = {};
    const users = await User.find(
      { _id: { $in: likedUserIds } },
      "firstName lastName profilePic"
    ).lean();

    users.forEach(u => {
      usersMap[u._id.toString()] = u;
    });

    const likedUsersMap = {};
    likedUsersAgg.forEach(l => {
      likedUsersMap[l._id.toString()] =
        l.users.map(uid => usersMap[uid.toString()]);
    });

    const likedSet = new Set(likes.map(l => l.item.toString()));
    const favoriteSet = new Set(favorites.map(f => f.item.toString()));
    const commentedSet = new Set(comments.map(c => c.item.toString()));

    const finalItems = items.map(item => ({
      ...item,
      isLiked: likedSet.has(item._id.toString()),
      isFavorited: favoriteSet.has(item._id.toString()),
      hasCommented: commentedSet.has(item._id.toString()),
      likedUsers: likedUsersMap[item._id.toString()] || []
    }));

    res.status(200).json({
      message: "Items fetched successfully",
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      data: finalItems
    });

  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch items",
      error: error.message
    });
  }
};


// exports.getLatestItemsForBuyer = async (req, res) => {
//   try {
//     const userId = req.user._id;
//     const buyer = await User.findById(userId)
//       .select("address")
//       .lean();

//     const page = parseInt(req.query.page) || 1;
//     const limit = parseInt(req.query.limit) || 10;
//     const skip = (page - 1) * limit;
//     const search = req.query.search?.trim();

//     const filter = {
//       isActive: true,
//       isPublished: false,
//       isDeleted: false,
//       seller: { $ne: userId }
//     };

//     if (search) {
//       filter.$or = [
//         { title: { $regex: search, $options: "i" } },
//         { description: { $regex: search, $options: "i" } },
//         { tags: { $regex: search, $options: "i" } }
//       ];
//     }

//     const [items, total] = await Promise.all([
//       Item.find(filter)
//         .populate("category", "title")
//         .populate("seller", "firstName lastName profilePic")
//         .sort({ createdAt: -1 })
//         .skip(skip)
//         .limit(limit),

//       Item.countDocuments(filter)
//     ]);

//     res.status(200).json({
//       message: "Latest items fetched successfully",
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit)
//       },
//       data: items
//     });

//   } catch (error) {
//     res.status(500).json({
//       message: "Failed to fetch latest items",
//       error: error.message
//     });
//   }
// };


exports.getLatestItemsForBuyer = async (req, res) => {
  try {
    const userId = req.user._id;

    const buyer = await User.findById(userId)
      .select("address")
      .lean();

    if (
      !buyer?.address?.latitude ||
      !buyer?.address?.longitude
    ) {
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
          maxDistance: 50 * 1000, // 50 km
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

      { $unwind: "$items" },

      {
        $match: {
          "items.isActive": true,
          "items.isPublished": true,
          "items.isDeleted": false
        }
      }
    ];


    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { "items.title": { $regex: search, $options: "i" } },
            { "items.description": { $regex: search, $options: "i" } },
            { "items.tags": { $regex: search, $options: "i" } }
          ]
        }
      });
    }

    pipeline.push(
      { $sort: { distance: 1, "items.createdAt": -1 } },

      {
        $facet: {
          metadata: [{ $count: "total" }],
          data: [
            { $skip: skip },
            { $limit: limit },

            {
              $lookup: {
                from: "categories",
                localField: "items.category",
                foreignField: "_id",
                as: "category"
              }
            },
            { $unwind: "$category" },

            {
              $project: {
                _id: "$items._id",
                title: "$items.title",
                description: "$items.description",
                price: "$items.price",
                media: "$items.media",
                createdAt: "$items.createdAt",

                distance: {
                  $round: ["$distance", 0]
                },

                category: {
                  _id: "$category._id",
                  title: "$category.title"
                },

                seller: {
                  _id: "$_id",
                  firstName: "$firstName",
                  lastName: "$lastName",
                  profilePic: "$profilePic"
                }
              }
            }
          ]
        }
      }
    );

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
      categories,
      locationType,
      scheduledAt,
      description,
    } = req.body;

    if (
      !sellerId ||
      !title ||
      price === undefined ||
      !contentType ||
      !categories?.length ||
      !scheduledAt
    ) {
      return res.status(400).json({
        message: "All required fields must be provided",
      });
    }

    if (buyerId.toString() === sellerId.toString()) {
      return res.status(403).json({
        message: "You cannot request media from yourself",
      });
    }

    if (new Date(scheduledAt) < new Date()) {
      return res.status(400).json({
        message: "Scheduled date must be in the future",
      });
    }

    const seller = await User.findById(sellerId).select("_id isDeleted");

    if (!seller || seller.isDeleted) {
      return res.status(404).json({
        message: "Seller not found",
      });
    }

    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const requestCharge = await calculateCommission(price, "requestPurchaseCommission");

    const request = await MediaRequest.create({
      buyer: buyerId,
      seller: sellerId,
      title,
      price,
      contentType,
      categories,
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
      commissionConfig: { type, value },
      status: "pending"
    });
    return res.status(201).json({
      message: "Media request sent successfully",
      data: request,
    });
  } catch (error) {
    console.error("request-media-error:", error);
    return res.status(500).json({
      message: "Failed to request media",
      error: error.message,
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
        .populate("categories", "title")
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


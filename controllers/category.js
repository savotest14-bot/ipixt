const Category = require("../models/category");
const fs = require("fs");
const path = require("path");
const SubCategory = require("../models/SubCategory");
exports.createCategory = async (req, res) => {
    try {
        const { title } = req.body;

        if (!title) {
            return res.status(400).json({ message: "Title is required" });
        }

        if (!req.file) {
            return res.status(400).json({ message: "Category image is required" });
        }

        const exists = await Category.findOne({
            title: title.trim(),
            isDeleted: false
        });

        if (exists) {
            return res.status(409).json({ message: "Category already exists" });
        }

        const imagePath = `${req.file.filename}`;

        const category = await Category.create({
            title: title.trim(),
            image: imagePath
        });

        res.status(201).json({
            message: "Category created successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            message: error.message || "Failed to create category"
        });
    }
};

exports.getAllCategories = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            search = ""
        } = req.query;

        const query = {
            isDeleted: false,
            title: { $regex: search, $options: "i" }
        };

        const [categories, total] = await Promise.all([
            Category.find(query)
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),

            Category.countDocuments(query)
        ]);

        res.status(200).json({
            message: "Categories fetched successfully",
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / limit)
            },
            data: categories
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch categories",
            error: error.message
        });
    }
};


exports.softDeleteCategory = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        category.isDeleted = true;
        category.isActive = false;
        await category.save();

        res.status(200).json({
            message: "Category deleted successfully"
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to delete category",
            error: error.message
        });
    }
};

exports.getCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        res.status(200).json({
            message: "Category fetched successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to fetch category",
            error: error.message
        });
    }
};

exports.updateCategoryById = async (req, res) => {
    try {
        const { categoryId } = req.params;
        const { title } = req.body;

        const category = await Category.findOne({
            _id: categoryId,
            isDeleted: false
        });

        if (!category) {
            return res.status(404).json({
                message: "Category not found"
            });
        }

        if (title) {
            category.title = title.trim();
        }

        if (req.file) {
            if (category.image) {
                const oldImagePath = path.join(
                    process.cwd(),       
                    "uploads",
                    "categories",
                    category.image     
                );

                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }

            category.image = req.file.filename;
        }

        await category.save();

        res.status(200).json({
            message: "Category updated successfully",
            data: category
        });
    } catch (error) {
        res.status(500).json({
            message: "Failed to update category",
            error: error.message
        });
    }
};

exports.addSubCategory = async (req, res) => {
  try {
    const { categoryId, title } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "SubCategory image is required"
      });
    }

    const image = req.file.filename;

    const subCategory = await SubCategory.create({
      categoryId,
      title,
      image
    });

    return res.status(201).json({
      success: true,
      message: "SubCategory created successfully",
      data: subCategory
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};


exports.updateSubCategory = async (req, res) => {
  try {

    const { id } = req.params;
    const { categoryId, title } = req.body;

    const subCategory = await SubCategory.findById(id);

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    const updateData = {
      categoryId,
      title
    };

    if (req.file) {

      if (subCategory.image) {
        const oldImagePath = path.join(
          __dirname,
          "../uploads/subCategories/",
          subCategory.image
        );
        if (fs.existsSync(oldImagePath)) {
          fs.unlinkSync(oldImagePath);
        }
      }

      updateData.image = req.file.filename;
    }

    const updatedSubCategory = await SubCategory.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    );

    return res.status(200).json({
      success: true,
      message: "SubCategory updated successfully",
      data: updatedSubCategory
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};



exports.deleteSubCategory = async (req, res) => {
  try {

    const { id } = req.params;

    const subCategory = await SubCategory.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "SubCategory deleted successfully"
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getSubCategoriesByCategory = async (req, res) => {
  try {

    const { categoryId } = req.params;

    const subCategories = await SubCategory.find({
      categoryId: categoryId,
      isDeleted: false
    });

    return res.status(200).json({
      success: true,
      count: subCategories.length,
      data: subCategories
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

exports.getSubCategoryById = async (req, res) => {
  try {

    const { id } = req.params;

    const subCategory = await SubCategory.findOne({
      _id: id,
      isDeleted: false
    });

    if (!subCategory) {
      return res.status(404).json({
        success: false,
        message: "SubCategory not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: subCategory
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

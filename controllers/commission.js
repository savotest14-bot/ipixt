const Commission = require("../models/Commission");

exports.upsertCommission = async (req, res) => {
  try {
    const { requestPurchaseCommission, directPurchaseCommission } = req.body;

    if (!requestPurchaseCommission || !directPurchaseCommission) {
      return res.status(400).json({
        message: "Both commission configurations are required",
      });
    }

    const validateCommission = (commission, label) => {
      const { type, value } = commission;

      if (!["percentage", "fixed"].includes(type)) {
        throw new Error(
          `${label} commission type must be 'percentage' or 'fixed'`
        );
      }

      if (typeof value !== "number" || value < 0) {
        throw new Error(`${label} commission value must be a positive number`);
      }

      if (type === "percentage" && value > 100) {
        throw new Error(`${label} percentage cannot exceed 100`);
      }
    };

    validateCommission(requestPurchaseCommission, "Request purchase");
    validateCommission(directPurchaseCommission, "Direct purchase");

    const commission = await Commission.findOneAndUpdate(
      {},
      {
        requestPurchaseCommission,
        directPurchaseCommission,
        updatedBy: req.user._id,
      },
      {
        new: true,
        upsert: true,
        runValidators: true,
      }
    );

    return res.status(200).json({
      message: "Commission saved successfully",
      data: commission,
    });
  } catch (error) {
    return res.status(400).json({
      message: error.message || "Failed to save commission",
    });
  }
};


exports.getCommission = async (req, res) => {
  try {
    const commission = await Commission.findOne();

    if (!commission) {
      return res.status(404).json({
        message: "Commission not configured yet",
      });
    }

    return res.status(200).json({
      data: commission,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch commission",
    });
  }
};


exports.getCommissionForUser = async (req, res) => {
  try {
    const commission = await Commission.findOne().select(
      "requestPurchaseCommission directPurchaseCommission"
    );

    if (!commission) {
      return res.status(404).json({
        message: "Commission not configured yet",
      });
    }

    return res.status(200).json({
      data: {
        requestPurchaseCommission: commission.requestPurchaseCommission,
        directPurchaseCommission: commission.directPurchaseCommission,
      },
    });
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch commission",
    });
  }
};

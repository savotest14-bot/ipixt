const Commission = require("../models/Commission");

/**
 * Calculate commission amount
 * @param {Number} price
 * @param {"requestPurchaseCommission" | "directPurchaseCommission"} commissionKey
 * @returns {{ commissionAmount: number, type: string, value: number }}
 */
const calculateCommission = async (price, commissionKey) => {
  if (!price || price < 0) {
    throw new Error("Invalid price");
  }

  const commission = await Commission.findOne();

  if (!commission || !commission[commissionKey]) {
    throw new Error(`${commissionKey} configuration not found`);
  }

  const { type, value } = commission[commissionKey];

  let commissionAmount = 0;

  if (type === "percentage") {
    commissionAmount = (price * value) / 100;
  } else if (type === "fixed") {
    commissionAmount = value;
  } else {
    throw new Error("Invalid commission type");
  }

  return {
    commissionAmount: Number(commissionAmount.toFixed(2)),
    type,
    value
  };
};

module.exports = calculateCommission;

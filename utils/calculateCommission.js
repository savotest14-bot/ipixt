const Commission = require("../models/Commission");

/**
 * Calculate commission amount
 * @param {Number} price - base price
 * @param {"requestPurchaseCommission" | "directPurchaseCommission"} commissionKey
 * @returns {Number} calculated commission amount
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

  let amount = 0;

  if (type === "percentage") {
    amount = (price * value) / 100;
  } else if (type === "fixed") {
    amount = value;
  }

  return Number(amount.toFixed(2));
};

module.exports = calculateCommission;

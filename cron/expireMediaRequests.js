const cron = require("node-cron");
const MediaRequest = require("../models/media");

cron.schedule("*/5 * * * *", async () => {
  try {
    const now = new Date();

    const result = await MediaRequest.updateMany(
      {
        status: "pending",
        expiresAt: { $lte: now },
      },
      {
        $set: { status: "expired" },
      }
    );

    if (result.modifiedCount > 0) {
      console.log(
        `[CRON] Expired ${result.modifiedCount} media requests`
      );
    }
  } catch (error) {
    console.error("[CRON] Media request expiry failed:", error);
  }
});

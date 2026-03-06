// const cron = require("node-cron");
// const MediaRequest = require("../models/media");

// cron.schedule("*/5 * * * *", async () => {
//   try {
//     const now = new Date();

//     const result = await MediaRequest.updateMany(
//       {
//         status: "pending",
//         expiresAt: { $lte: now },
//       },
//       {
//         $set: { status: "expired" },
//       }
//     );

//     if (result.modifiedCount > 0) {
//       console.log(
//         `[CRON] Expired ${result.modifiedCount} media requests`
//       );
//     }
//   } catch (error) {
//     console.error("[CRON] Media request expiry failed:", error);
//   }
// });


const cron = require("node-cron");
const MediaRequest = require("../models/media");

console.log("Media expiry cron started...");

cron.schedule(
  "*/5 * * * *",
  async () => {
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

      console.log(
        `[CRON] Checked media requests at ${now.toISOString()}`
      );

      if (result.modifiedCount > 0) {
        console.log(
          `[CRON] Expired ${result.modifiedCount} media requests`
        );
      }
    } catch (error) {
      console.error("[CRON] Media request expiry failed:", error);
    }
  },
  {
    timezone: "Asia/Kolkata",
  }
);
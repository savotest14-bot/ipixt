const { canSendNotification } = require("../functions/commons");

const sendLikeNotification = async (receiverId, data) => {
  const allowed = await canSendNotification(receiverId, "likes");
  
  if (!allowed) return;

  // ✅ send push / email / in-app notification
};

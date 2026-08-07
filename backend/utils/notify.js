import Notification from "../models/notification.model.js";
import { sendPush } from "./push.js";

const ONE_HOUR_MS = 60 * 60 * 1000;

// ponytail: naive per-hour dedupe per (userId, fromUser, type, target) so a
// like/comment burst doesn't spam the notification list — move to a proper
// digest job if volume grows. Shared by post reactions and story likes.
export const notifyOnce = async ({ userId, fromUser, type, message, metadata }) => {
  if (userId.toString() === fromUser.toString()) return; // never notify yourself
  const recent = await Notification.findOne({
    userId,
    fromUser,
    type,
    read: false,
    createdAt: { $gte: new Date(Date.now() - ONE_HOUR_MS) },
    ...(metadata?.postId ? { "metadata.postId": metadata.postId } : {}),
    ...(metadata?.storyId ? { "metadata.storyId": metadata.storyId } : {}),
  });
  if (recent) return;
  await Notification.create({ userId, fromUser, type, message, metadata });
  sendPush(userId, { title: "Mitrata", body: message, data: { type, ...metadata } })
    .catch((err) => console.error("sendPush failed:", err.message));
};

import express from "express";
import dotenv from "dotenv"; // Import first
dotenv.config();           // Load variables IMMEDIATELY

// NOW import everything else
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import postRoutes from "./routes/post.routes.js";
import userRoute from "./routes/user.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import { Server } from "socket.io";
import http from "http";

const app = express();
const httpServer = http.createServer(app);

const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3000";

const io = new Server(httpServer, {
  cors: {
    origin: FRONTEND_URL,
    methods: ["GET", "POST"]
  }
});

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" } // allow images from Cloudinary
}));
app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting on auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 attempts per window
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/login", authLimiter);
app.use("/register", authLimiter);

// ============ ROUTES ============
app.use('/api', postRoutes);
app.use('/api', userRoute);
app.use('/api', notificationRoutes);

// ============ ONLINE PRESENCE TRACKING ============
const onlineUsers = new Map(); // userId -> Set of socketIds

// REST endpoint to get online users list
app.get("/api/online-users", (req, res) => {
  const onlineList = Array.from(onlineUsers.keys());
  res.json({ onlineUsers: onlineList });
});

// ============ SOCKET.IO WITH JWT AUTH ============
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error("Authentication required"));
  }
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = decoded.userId;
    next();
  } catch (err) {
    next(new Error("Invalid or expired token"));
  }
});

io.on("connection", (socket) => {
  const userId = socket.userId.toString();
  console.log("User Connected:", userId);

  // Track online presence
  if (!onlineUsers.has(userId)) {
    onlineUsers.set(userId, new Set());
  }
  onlineUsers.get(userId).add(socket.id);

  // Broadcast online status to all connected users
  io.emit("userOnline", { userId });

  // Join user to their own room for directed messages
  socket.join(userId);

  // Send current online users list on connect
  socket.emit("onlineUsersList", Array.from(onlineUsers.keys()));

  socket.on("joinRoom", (roomUserId) => {
    // Users can only join their own room
    if (roomUserId === userId) {
      socket.join(roomUserId);
    }
  });

  socket.on("sendMessage", (message) => {
    // Emit to the receiver's room
    io.to(message.receiverId).emit("newMessage", message);
  });

  socket.on("deleteMessage", (data) => {
    const { messageId, receiverId } = data;
    // Notify receiver about deleted message
    io.to(receiverId).emit("messageDeleted", { messageId });
  });

  // Typing indicator
  socket.on("typing", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("userTyping", {
      senderId: userId,
      isTyping: true
    });
  });

  socket.on("stopTyping", (data) => {
    const { receiverId } = data;
    io.to(receiverId).emit("userTyping", {
      senderId: userId,
      isTyping: false
    });
  });

  // Read receipts
  socket.on("messagesRead", (data) => {
    const { senderId, receiverId } = data;
    io.to(senderId).emit("messagesRead", {
      readBy: receiverId
    });
  });

  socket.on("disconnect", () => {
    console.log("User Disconnected:", userId);

    // Remove this socket from the user's set
    if (onlineUsers.has(userId)) {
      onlineUsers.get(userId).delete(socket.id);
      // Only broadcast offline if user has no more connected sockets
      if (onlineUsers.get(userId).size === 0) {
        onlineUsers.delete(userId);
        io.emit("userOffline", { userId });
      }
    }
  });

  // ============ WEBRTC VOICE CALLING SIGNALING ============
  socket.on("callUser", (data) => {
    // data: { receiverId, offer, callerInfo: { name, avatar } }
    io.to(data.receiverId).emit("incomingCall", {
      callerId: userId,
      callerInfo: data.callerInfo,
      offer: data.offer
    });
  });

  socket.on("callDelivered", (data) => {
    // data: { callerId }
    io.to(data.callerId).emit("callDelivered", { receiverId: userId });
  });

  socket.on("answerCall", (data) => {
    // data: { callerId, answer }
    io.to(data.callerId).emit("callAnswered", {
      answer: data.answer
    });
  });

  socket.on("iceCandidate", (data) => {
    // data: { targetId, candidate }
    io.to(data.targetId).emit("iceCandidate", {
      candidate: data.candidate,
      senderId: userId
    });
  });

  socket.on("endCall", (data) => {
    // data: { targetId }
    io.to(data.targetId).emit("callEnded", { endedBy: userId });
  });

  socket.on("rejectCall", (data) => {
    // data: { callerId }
    io.to(data.callerId).emit("callRejected", { rejectedBy: userId });
  });
});

// Store io instance for controllers
app.set("socketio", io);

// ============ DATABASE & START ============
mongoose.connect(process.env.MONGODB_URI)
  .then(() => {
    console.log("Connected to MongoDB");
    httpServer.listen(process.env.PORT || 9080, () => {
      console.log(`Server running on port ${process.env.PORT || 9080}`);
    });
  })
  .catch((err) => console.error("MongoDB Connection Error:", err));

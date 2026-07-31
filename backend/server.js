import express from "express";
import dotenv from "dotenv"; // Import first
dotenv.config();           // Load variables IMMEDIATELY

// NOW import everything else
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import postRoutes from "./routes/post.routes.js";
import userRoute from "./routes/user.routes.js";
import notificationRoutes from "./routes/notification.routes.js";
import adminRoutes from "./routes/admin.routes.js";
import storyRoutes from "./routes/story.routes.js";
import { Server } from "socket.io";
import http from "http";

const app = express();
// Render terminates TLS and proxies requests through, setting X-Forwarded-For.
// Without this, express-rate-limit can't tell real client IPs apart (every
// request looks like it comes from Render's proxy), which risks one heavy
// user's traffic exhausting the rate-limit bucket for everyone else. `1`
// trusts exactly one hop (Render's own proxy), not an arbitrary chain.
app.set("trust proxy", 1);
const httpServer = http.createServer(app);

const allowedOrigins = [
  "http://localhost:3000",
  "https://mitrata.vercel.app",
  process.env.FRONTEND_URL
].filter(Boolean); // Remove undefined/null

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("CORS Blocked:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Google Identity Services signs the user in via a popup that posts a message
  // back to this origin — the default "same-origin" COOP silently blocks that.
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
// Google's redirect-mode sign-in POSTs here as a real top-level browser
// navigation, not a JS fetch/XHR — browsers send a literal Origin: "null"
// for that kind of cross-site form submission, which the origin check above
// (correctly) rejects for everything else. CORS was never relevant to this
// route in the first place: nothing reads the response via JS, so there's
// nothing for a CORS header to protect here.
app.use((req, res, next) => {
  if (req.path === "/api/auth/google/callback") return next();
  return cors(corsOptions)(req, res, next);
});
app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting on auth endpoints — every route in this app is mounted
// under /api (see app.use('/api', ...) below), so limiters registered on
// bare "/login"/"/register" never actually matched a real request and did
// nothing. Matching the real mount path is what makes this functional.
//
// This strict budget exists to slow down password guessing — it only makes
// sense on endpoints that accept a guessable credential (login/register/
// google). refresh and switch-account both require an already-valid
// httpOnly cookie to do anything at all, so there's nothing to brute-force
// there; they used to share this same budget, which meant a background
// token refresh (fires automatically every ~15min per open tab) or
// switching accounts a couple of times in one session could burn through
// the same 20 requests meant to stop credential stuffing.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/login", authLimiter);
app.use("/api/register", authLimiter);
app.use("/api/auth/google", authLimiter);

// Session upkeep, not credential guessing — generous ceiling just to blunt
// outright abuse, not to throttle normal use.
const sessionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/auth/refresh", sessionLimiter);
app.use("/api/auth/switch-account", sessionLimiter);

// OTP endpoints send an email per request — the real abuse vector here is
// email-bombing a victim's inbox, not just credential stuffing, so these
// get their own (slightly tighter) limiter independent of the general one.
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many attempts, please try again later" },
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api/auth/send-otp", otpLimiter);
app.use("/api/auth/resend-otp", otpLimiter);
app.use("/api/auth/verify-otp", otpLimiter);
app.use("/api/auth/reset-password", otpLimiter);

// A generous general-purpose limiter for everything else — mainly to blunt
// scraping/abuse of the public, unauthenticated endpoints (search, public
// profile lookup, trending/stats) at real traffic volume.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false
});
app.use("/api", apiLimiter);

// ============ ROUTES ============
// Simple health check to verify API prefix is working
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', msg: 'Backend is running with /api prefix' });
});
app.use('/api', postRoutes);
app.use('/api', userRoute);
app.use('/api', notificationRoutes);
// storyRoutes must be mounted before adminRoutes — adminRoutes' internal
// `router.use(verifyToken, isAdmin)` has no path restriction, so it silently
// swallows any request that fell through unmatched from the routers above it
// with "Admin access required", never letting it reach a later router.
app.use('/api', storyRoutes);
app.use('/api', adminRoutes);

// ============ ONLINE PRESENCE TRACKING ============
const onlineUsers = new Map(); // userId -> Set of socketIds
app.set("onlineUsers", onlineUsers); // shared reference so routes can read live presence count

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
    // data: { receiverId, offer, callerInfo: { name, avatar }, isVideo }
    io.to(data.receiverId).emit("incomingCall", {
      callerId: userId,
      callerInfo: data.callerInfo,
      offer: data.offer,
      isVideo: !!data.isVideo
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

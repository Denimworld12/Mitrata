import express from "express";
import dotenv from "dotenv"; // Import first
dotenv.config();           // Load variables IMMEDIATELY

// Sentry needs to init before anything else so it can auto-instrument what
// follows. Leave SENTRY_DSN unset in .env to keep error tracking disabled.
import * as Sentry from "@sentry/node";
if (process.env.SENTRY_DSN) {
  Sentry.init({ dsn: process.env.SENTRY_DSN });
}

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
import musicRoutes from "./routes/music.routes.js";
import { Server } from "socket.io";
import http from "http";
import { sendVoipPush } from "./utils/voipPush.js";

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
  },
  // Defaults (pingInterval 25s + pingTimeout 20s) mean an abruptly-dropped
  // connection — laptop lid closed, network cut, tab killed, no clean
  // disconnect handshake — can sit in onlineUsers as "online" for up to
  // ~45s before the server notices. During that window the UI still shows
  // a green dot, but there's no live socket to actually deliver a call to.
  // Shorter timers don't remove that window, just shrink it.
  pingInterval: 10000,
  pingTimeout: 8000
});

// ============ SECURITY MIDDLEWARE ============
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  // Google Identity Services signs the user in via a popup that posts a message
  // back to this origin — the default "same-origin" COOP silently blocks that.
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }
}));
// Google's and Apple's redirect-mode sign-in both POST here as a real
// top-level browser navigation, not a JS fetch/XHR — browsers send a literal
// Origin: "null" for that kind of cross-site form submission, which the
// origin check above (correctly) rejects for everything else. CORS was
// never relevant to either route in the first place: nothing reads the
// response via JS, so there's nothing for a CORS header to protect here.
const CORS_EXEMPT_PATHS = new Set(["/api/auth/google/callback", "/api/auth/apple/callback"]);
app.use((req, res, next) => {
  if (CORS_EXEMPT_PATHS.has(req.path)) return next();
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
app.use("/api/auth/apple", authLimiter);
app.use("/api/auth/2fa/verify-login", authLimiter); // guesses a 6-digit code — same budget as password guessing

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
// TEMP: verifying Sentry actually sends from this deployed instance, not
// just from a local test script. Remove after confirming in the dashboard.
app.get('/api/_sentry_test', async (req, res) => {
  if (process.env.SENTRY_DSN) {
    Sentry.captureMessage('Mitrata LIVE Render server Sentry test — safe to ignore');
    await Sentry.flush(3000);
  }
  res.json({ sent: !!process.env.SENTRY_DSN });
});
app.use('/api', postRoutes);
app.use('/api', userRoute);
app.use('/api', notificationRoutes);
// storyRoutes must be mounted before adminRoutes — adminRoutes' internal
// `router.use(verifyToken, isAdmin)` has no path restriction, so it silently
// swallows any request that fell through unmatched from the routers above it
// with "Admin access required", never letting it reach a later router.
app.use('/api', storyRoutes);
app.use('/api', musicRoutes);
app.use('/api', adminRoutes);

// Catches anything that escapes a route handler uncaught (most controllers
// already try/catch and respond with their own res.status(500), so those
// never reach here — this is a safety net for what isn't already handled,
// not full error-reporting coverage. Must be registered after all routes.
if (process.env.SENTRY_DSN) {
  Sentry.setupExpressErrorHandler(app);
}

// ============ ONLINE PRESENCE TRACKING ============
const onlineUsers = new Map(); // userId -> Set of socketIds
app.set("onlineUsers", onlineUsers); // shared reference so routes can read live presence count

// A call placed while the callee's app is fully killed (no live socket) gets
// a VoIP push instead — this holds the offer just long enough for that push
// to wake the app and reconnect its socket, at which point it's redelivered
// as a normal "incomingCall" below. Single-process in-memory map: fine for
// this deployment's one instance, would need a shared store (Redis) behind
// a load balancer.
const pendingCalls = new Map(); // receiverId -> { callerId, callerInfo, offer, isVideo, timeout }
const PENDING_CALL_TTL_MS = 25_000; // matches the mobile client's own ring timeout

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

  // A VoIP push woke this app up specifically to take a call — deliver the
  // offer that was waiting for it, same event/shape as the live-socket path
  // below, so the client needs no special handling for "woken from killed".
  const pending = pendingCalls.get(userId);
  if (pending) {
    clearTimeout(pending.timeout);
    pendingCalls.delete(userId);
    socket.emit("incomingCall", {
      callerId: pending.callerId,
      callerInfo: pending.callerInfo,
      offer: pending.offer,
      isVideo: pending.isVideo
    });
  }

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
    const receiverId = data.receiverId?.toString();
    const receiverRoom = io.sockets.adapter.rooms.get(receiverId);
    console.log(`callUser: ${userId} -> ${receiverId}, receiverRoom size: ${receiverRoom?.size || 0}`);

    // onlineUsers can say "online" for a socket that's actually already
    // dead (see the pingTimeout comment above) — the room membership check
    // here is the real-time truth: it reflects only sockets Socket.IO has
    // confirmed are still connected. If it's empty, `io.to(receiverId).emit`
    // below would silently go nowhere, and the caller would otherwise sit
    // in ringback for the full 30s client-side timeout with zero feedback.
    // Telling them immediately, and reconciling the stale presence entry,
    // is strictly better than waiting to find out the same way regardless.
    if (!receiverRoom || receiverRoom.size === 0) {
      if (onlineUsers.has(receiverId)) {
        onlineUsers.delete(receiverId);
        io.emit("userOffline", { userId: receiverId });
      }

      // No live socket doesn't necessarily mean unreachable — a VoIP push
      // can still wake a killed iOS app. Hold the offer briefly so it can
      // be redelivered the moment that reconnect happens (see the
      // pendingCalls check right after socket.join(userId) above); if nothing
      // reconnects in time this just expires, same net effect as the
      // immediate callFailed this replaces.
      const existing = pendingCalls.get(receiverId);
      if (existing) clearTimeout(existing.timeout);
      const timeout = setTimeout(() => pendingCalls.delete(receiverId), PENDING_CALL_TTL_MS);
      pendingCalls.set(receiverId, {
        callerId: userId,
        callerInfo: data.callerInfo,
        offer: data.offer,
        isVideo: !!data.isVideo,
        timeout
      });
      console.log(`callUser: ${receiverId} has no live socket — holding as pending + sending VoIP/data push`);
      sendVoipPush(receiverId, {
        callerId: userId,
        callerInfo: data.callerInfo,
        offer: data.offer,
        isVideo: data.isVideo
      }).catch((err) => console.error("sendVoipPush failed:", err.message));
      return;
    }

    console.log(`callUser: emitting incomingCall to ${receiverId} (live socket)`);
    io.to(receiverId).emit("incomingCall", {
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
    // data: { callerId, reason? } — reason is e.g. "busy" when the callee's
    // own client auto-rejected because they're already on another call.
    io.to(data.callerId).emit("callRejected", { rejectedBy: userId, reason: data.reason });
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

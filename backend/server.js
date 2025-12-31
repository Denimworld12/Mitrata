import express from "express";
import dotenv from "dotenv"; // Import first
dotenv.config();           // Load variables IMMEDIATELY

// NOW import everything else
import cors from "cors";
import mongoose from "mongoose";
import postRoutes from "./routes/post.routes.js";
import userRoute from "./routes/user.routes.js";
import { Server } from "socket.io";
import http from "http";
const app = express();
const httpServer = http.createServer(app);
// dotenv.config();
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
app.set("socketio", io);
app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(userRoute);
app.use(postRoutes);
app.use(express.static("uploads"))



io.on("connection", (socket) => {
  console.log("a user connected bhai ", socket.id);
  socket.on("join", (userId) => {
    socket.join(userId)
    console.log(`User with ID: ${userId} joined their room.`);
  })
  socket.on("disconnect", () => {
    console.log("user disconnected bhai ", socket.id);
  })
})
const start = async () => {
  await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  // app.listen
  httpServer.listen(9080, () => {
    console.log("server is on bhai ", 9080)
  })
}
start();

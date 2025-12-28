import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import postRoutes from "./routes/post.routes.js"
import userRoute from "./routes/user.routes.js"

const app = express();

dotenv.config();

app.use(cors());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(userRoute);
app.use(postRoutes);
app.use(express.static("uploads"))

const start = async () => {
    await mongoose.connect(process.env.MONGO_URL, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
    app.listen(9080, () => {
        console.log("server is on bhai ", 9080)
    })  
}
start();

import { Router } from "express";
import { verifyToken } from "../middleware/auth.middleware.js";
import { searchTracks } from "../controllers/music.controller.js";

const router = Router();

router.route("/music/search").get(verifyToken, searchTracks);

export default router;

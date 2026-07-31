import { Router } from "express";
import multer from "multer";
import { verifyToken } from "../middleware/auth.middleware.js";
import { Storage } from "../config/cloudinary.js";
import { createStory, deleteStory, getStories, viewStory } from "../controllers/story.controller.js";

const router = Router();
const upload = multer({ storage: Storage, limits: { fileSize: 25 * 1024 * 1024 } });

router.route("/story").post(verifyToken, upload.single("media"), createStory);
router.route("/stories").get(verifyToken, getStories);
router.route("/story/:id/view").post(verifyToken, viewStory);
router.route("/story/:id").delete(verifyToken, deleteStory);

export default router;

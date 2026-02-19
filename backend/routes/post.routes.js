
import { Router } from "express";
import { activecheck, commentPost, createPost, delete_Comments, deletePost, getAllPosts, getComment_by_Post, getPostAnalytics, increament_likes, reactToComplaint } from "../controllers/post.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import multer from "multer";
import { Storage } from "../config/cloudinary.js";
const router = Router();

const upload = multer({ storage: Storage })

// Public health check
router.route("/").get(activecheck);

// All post routes require authentication
router.route('/post').post(upload.single('media'), verifyToken, createPost);
router.route('/posts').get(verifyToken, getAllPosts);
router.route('/delete_post').post(verifyToken, deletePost);
router.route('/comment_post').post(verifyToken, commentPost);
router.route('/getcomment_by_post').get(verifyToken, getComment_by_Post);
router.route('/delete_comments').delete(verifyToken, delete_Comments);
router.route('/increment_like').post(verifyToken, increament_likes);
router.route('/react/:id').post(verifyToken, reactToComplaint);

// Analytics route
router.route('/user/post_analytics').get(verifyToken, getPostAnalytics);

export default router;


import { Router } from "express";
import { activecheck, commentPost, createPost, delete_Comments, deletePost, editComment, getAllPosts, getBookmarkedPosts, getComment_by_Post, getLikedPosts, getPostAnalytics, getPostById, getPostsByUsername, getPublicStats, getTrendingTags, reactToComplaint, toggleBookmark } from "../controllers/post.controller.js";
import { verifyToken } from "../middleware/auth.middleware.js";
import multer from "multer";
import { Storage } from "../config/cloudinary.js";
const router = Router();

const upload = multer({ storage: Storage, limits: { fileSize: 25 * 1024 * 1024 } })

// Public health check
router.route("/").get(activecheck);

// Public — target of a shared post link
router.route('/post/:id').get(getPostById);

// Public — landing page + dashboard rail, no auth required
router.route('/trending/tags').get(getTrendingTags);
router.route('/stats/public').get(getPublicStats);

// All post routes require authentication
router.route('/post').post(verifyToken, upload.single('media'), createPost);
router.route('/posts').get(verifyToken, getAllPosts);
router.route('/posts/user/:username').get(verifyToken, getPostsByUsername);
router.route('/delete_post').post(verifyToken, deletePost);
router.route('/comment_post').post(verifyToken, commentPost);
router.route('/getcomment_by_post').get(verifyToken, getComment_by_Post);
router.route('/delete_comments').delete(verifyToken, delete_Comments);
router.route('/edit_comment').patch(verifyToken, editComment);
router.route('/react/:id').post(verifyToken, reactToComplaint);

// Analytics route
router.route('/user/post_analytics').get(verifyToken, getPostAnalytics);
router.route('/user/liked_posts').get(verifyToken, getLikedPosts);
router.route('/user/bookmark').post(verifyToken, toggleBookmark);
router.route('/user/bookmarked_posts').get(verifyToken, getBookmarkedPosts);

export default router;

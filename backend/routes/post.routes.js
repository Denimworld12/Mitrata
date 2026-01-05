
import { Router } from "express";
import { activecheck, commentPost, createPost, delete_Comments, deletePost, getAllPosts, getComment_by_Post, increament_likes, reactToComplaint } from "../controllers/post.controller.js";
import {verifyToken, verifyTokenAlt} from "../middleware/auth.middleware.js";
import mongoose from "mongoose";
import multer from "multer";
import { Storage } from "../config/cloudinary.js";
const router = Router();
// const storage = multer.diskStorage({
//     destination:(req, file , cb)=>{
//         cb (null, 'uploads/')
//     },
//     filename:(req, file, cb )=>{
//         cb (null, file.originalname)
//     },

// })
const upload = multer({storage:Storage})

router.route("/").get(activecheck);
router.route('/post').post(upload.single('media'),createPost)
router.route('/posts').get(verifyToken, getAllPosts)
router.route('/delete_post').post(deletePost)
router.route('/comment_post').post(commentPost)
router.route('/getcomment_by_post').get(getComment_by_Post)
router.route('/delete_comments').delete(delete_Comments)
router.route('/increment_like').post(increament_likes)
router.route('/react/:id').post(verifyToken, reactToComplaint)
export default router;

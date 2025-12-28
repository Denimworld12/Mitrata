
import { Router } from "express";
import { activecheck, commentPost, createPost, delete_Comments, deletePost, getAllPosts, getComment_by_Post, increament_likes } from "../controllers/post.controller.js";
import mongoose from "mongoose";
import multer from "multer";

const router = Router();
const storage = multer.diskStorage({
    destination:(req, file , cb)=>{
        cb (null, 'uploads/')
    },
    filename:(req, file, cb )=>{
        cb (null, file.originalname)
    },

})
const upload = multer({storage:storage})

router.route("/").get(activecheck);
router.route('/post').post(upload.single('media'),createPost)
router.route('/posts').get(getAllPosts)
router.route('/delete_post').post(deletePost)
router.route('/comment_post').post(commentPost)
router.route('/getcomment_by_post').get(getComment_by_Post)
router.route('/delete_comments').delete(delete_Comments)
router.route('/increment_like').post(increament_likes)
export default router;

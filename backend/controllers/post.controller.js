import User from "../models/users.model.js";

import Profile from "../models/profile.model.js";
import Post from "../models/posts.model.js";
import Comment from "../models/comments.model.js";
import bcrypt from 'bcrypt'

export const activecheck = async (req, res) => {
    return res.status(200).json({ message: "Running route post" });
}

export const createPost = async (req, res) => {
    const { token } = req.body;
    try {
        const user = await User.findOne({ token });
        if (!user) return res.status(400).json({ message: "not found user" })
        const post = new Post(
            {
                userId: user._id,
                body: req.body.body,
                media: req.file != undefined ? req.file.filename : "",
                fileType: req.file != undefined ? req.file.mimetype.split('/')[1] : ""
            }

        )
        await post.save()
        return res.status(200).json({ message: "post created" })
    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}

export const getAllPosts = async (req, res) => {
   
    try {
        const posts = await Post.find().populate('userId', 'name username email profilePicture createAt');
        return res.json({ posts })
    } catch (error) {
        return res.status(500).json({ message: error.message })
    }
}

export const deletePost = async (req, res) => {
    const { token, post_id } = req.body
    try {
        const user = await User.findOne({ token: token }).select('_id');
        if (!user) return res.status(400).json({ message: "not found user" })
        const post = await Post.findOne({ _id: post_id })
        if (!post) return res.status(400).json({ message: "not found post" })
        if (post.userId.toString() !== user._id.toString())
            return res.status(401).json({ message: "Unauthrized" })
        await Post.deleteOne({ _id: post_id })
        return res.json({ message: "post DEleted" })

    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}

export const commentPost = async (req, res) => {
    const { token, post_id, commentBody } = req.body
    try {
        const user = await User.findOne({ token: token }).select('_id');
        if (!user) return res.status(400).json({ message: "not found user" })
        const post = await Post.findById(post_id)
        if (!post)
            return res.status(400).json({ message: "not found post" })
        const comments = new Comment(
            {
                userId: user._id,
                post_Id: post_id,
                body: commentBody
            }
        )
        await comments.save();

        return res.status(200).json({message: "comment added "})

    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}

export const getComment_by_Post = async (req, res) => {
    const { post_id } = req.query
    try {
        const post = await Post.findById({_id:post_id})
        const comments = await Comment.find({ post_Id:  post_id }).populate('userId','username name profilePicture').sort({createAt:-1})
        if (!post)
            return res.status(400).json({ message: "post not found" })
        return res.status(200).json({ comments })
    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}

export const delete_Comments = async (req, res)=>{
    const { token, comment_id } = req.body
    try {
        const user = await User.findOne({ token: token }).select('_id');
        if (!user) return res.status(400).json({ message: "not found user" })
        const comments = await Comment.findOne({
            _id: comment_id

        })
        if (!comments)
            return res.status(400).json({ message: "not found post" })
        await Comment.deleteOne({"_id":comment_id})

        return res.status(200).json({message: "comment deleted "})

    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}


export const increament_likes= async (req, res)=>{
    const { token, post_id } = req.body
    try {
        const user = await User.findOne({ token: token }).select('_id');
        if (!user) return res.status(400).json({ message: "not found user" })
        const posts = await Post.findOne({ _id: post_id })
        if (!posts) 
            return res.status(400).json({ message: "post not found" })
        posts.likes= posts.likes+1;
        await posts.save()
        return res.status(200).json({message: "like added "})

    } catch (error) {
        return res.status(505).json({ message: error.message })
    }
}
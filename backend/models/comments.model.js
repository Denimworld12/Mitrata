
import mongoose from "mongoose";


const commentSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    post_Id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'posts',
        // getComment_by_Post looks up every comment on a post by this field —
        // unindexed, that's a full collection scan across every comment ever
        // made, on every single post view.
        index:true
    },
    body:{
        type:String,
        required:true
    }

// getComment_by_Post sorts by createdAt — without { timestamps: true } that
// field never existed, so "newest first" was silently a no-op (arbitrary
// insertion order), not just slow.
}, { timestamps: true })

const Comment= mongoose.model('comment',commentSchema)

export default Comment;


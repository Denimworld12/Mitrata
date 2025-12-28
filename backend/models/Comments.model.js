
import mongoose from "mongoose";


const commentSchema=new mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    post_Id:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'posts'
    },
    body:{
        type:String,
        required:true
    }
    
})

const Comment= mongoose.model('comment',commentSchema)

export default Comment;


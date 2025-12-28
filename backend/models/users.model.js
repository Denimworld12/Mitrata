import mongoose from "mongoose";


const userSchema =new mongoose.Schema({
    name:{
        type:String,
        required:true
    },
    username:{
        type:String,
        required:true, 
        unique:true
    },
    email:{
        type:String,
        required:true,
        unique:true
    },
    active:{
        type:Boolean,
        default:true
    },
    password:{
        type:String,
        required:true
    },
    profilePicture:{
        type:String,
        default:'default.jpg'
    },
    createAt:{
        type:Date,
        default:Date.now
    },
    token:{
        type:String,
        default:''
    }
})

const User= mongoose.model('user',userSchema);
export default User;


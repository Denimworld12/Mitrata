import mongoose from "mongoose";


const educationSchema=   new mongoose.Schema({
    school:{
        type:String, 
        default:''
    },
    degree:{
        type:String,
        default:''
    },
    feildStudy:{
        type:String,
        default:''
    },

})



const workSchema = new mongoose.Schema({
    company:{
        type:String,
        default:''
    },
    position:{
        type:String,
        default:''
    },
    years:{
        type:String,
        default:''
    }
})

const profileSchema=new  mongoose.Schema({
    userId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    bio:{
        type:String,
        default:''
    },
    currentPost:{
        type:String,
        default:''
    },
    pastWork:{
        type:[workSchema],
        default:[]
    },
    education:{
        type:[educationSchema],
        default:[]
    }
})

const Profile = mongoose.model('Profile', profileSchema);
export default Profile;

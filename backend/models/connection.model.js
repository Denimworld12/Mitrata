import mongoose from "mongoose";
const connectionSchema =    new mongoose.Schema({
    userId:{
        type: mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    connectionId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:'user'
    },
    status_accepted:{
        type:Boolean,
        default:null
    },
})

const ConnectionRequest= mongoose.model("ConnectionRequest",connectionSchema);
export default ConnectionRequest;
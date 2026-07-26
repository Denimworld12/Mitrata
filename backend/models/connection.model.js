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

// Every connection-related read (feed ranking, suggestions, stories,
// my-network, request-already-exists checks) queries by one of these two
// fields via an $or — without indexes this is a full collection scan on
// nearly every authenticated page load once the table has real volume.
connectionSchema.index({ userId: 1, status_accepted: 1 });
connectionSchema.index({ connectionId: 1, status_accepted: 1 });

const ConnectionRequest= mongoose.model("ConnectionRequest",connectionSchema);
export default ConnectionRequest;
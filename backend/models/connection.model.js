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
    // Direction-independent identity for a pair — "userA_userB" with the two
    // ids sorted, so (A,B) and (B,A) collide on the same key regardless of
    // who sent the request. The unique index on it is what actually
    // prevents two near-simultaneous sendconnectionrequest calls between the
    // same pair from both passing the existence check and inserting two
    // documents — the app-level findOne-then-save check alone can't close
    // that race, only a DB-level constraint can.
    // sparse: existing documents from before this field existed have no
    // pairKey at all — a plain unique index would fail to even build over
    // multiple such "missing" values. Sparse excludes them from the
    // constraint while still fully enforcing uniqueness among every
    // document that DOES have one, which is every document created from
    // here on — exactly the ones actually at risk of a fresh race.
    pairKey: {
        type: String,
        unique: true,
        sparse: true,
    },
})

connectionSchema.pre("validate", function (next) {
    if (this.userId && this.connectionId) {
        this.pairKey = [this.userId.toString(), this.connectionId.toString()].sort().join("_");
    }
    next();
});

// Every connection-related read (feed ranking, suggestions, stories,
// my-network, request-already-exists checks) queries by one of these two
// fields via an $or — without indexes this is a full collection scan on
// nearly every authenticated page load once the table has real volume.
connectionSchema.index({ userId: 1, status_accepted: 1 });
connectionSchema.index({ connectionId: 1, status_accepted: 1 });

const ConnectionRequest= mongoose.model("ConnectionRequest",connectionSchema);
export default ConnectionRequest;
import mongoose from "mongoose";

const reportSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "user",
        required: true
    },
    targetType: {
        type: String,
        enum: ["user", "post", "comment"],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["pending", "resolved", "dismissed"],
        default: "pending"
    }
}, { timestamps: true });

const Report = mongoose.model("report", reportSchema);
export default Report;

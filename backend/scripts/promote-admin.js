// One-off CLI: node scripts/promote-admin.js someone@example.com
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import User from "../models/users.model.js";

const email = process.argv[2];
if (!email) {
    console.error("Usage: node scripts/promote-admin.js <email>");
    process.exit(1);
}

await mongoose.connect(process.env.MONGODB_URI);
const user = await User.findOneAndUpdate({ email }, { role: "admin" }, { new: true });
if (!user) {
    console.error(`No user found with email ${email}`);
} else {
    console.log(`${user.email} is now an admin.`);
}
await mongoose.disconnect();

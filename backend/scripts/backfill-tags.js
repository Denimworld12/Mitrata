// One-off CLI: node scripts/backfill-tags.js
// Extracts #hashtags from existing posts' bodies so trending tags aren't
// empty until new posts are created.
import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import Post from "../models/posts.model.js";
import { extractTags } from "../controllers/post.controller.js";

await mongoose.connect(process.env.MONGODB_URI);

const posts = await Post.find({ $or: [{ tags: { $exists: false } }, { tags: [] }] });
let updated = 0;
for (const post of posts) {
    const tags = extractTags(post.body || "");
    if (tags.length > 0) {
        post.tags = tags;
        await post.save();
        updated++;
    }
}

console.log(`Backfilled tags on ${updated} of ${posts.length} posts.`);
await mongoose.disconnect();

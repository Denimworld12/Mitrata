import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary with your credentials
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Setup Cloudinary Storage for Multer
export const Storage = new CloudinaryStorage({
  cloudinary: cloudinary,

  params: {
    upload_preset: 'mitrata_social',
    folder: 'mitrata_social', // Name of the folder in Cloudinary
    // resource_type: 'auto' lets Cloudinary route video vs image correctly —
    // without it every upload was forced through the image pipeline, so any
    // video (messaging attachments, video stories — both wired up in the UI
    // with accept="image/*,video/*") failed outright regardless of format.
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'mp4', 'mov', 'webm'],
  },
});
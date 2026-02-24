import multer from "multer";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads folders
const baseUploadDir = path.join(__dirname, "..", "uploads");
const imageDir = path.join(baseUploadDir, "images");
const videoDir = path.join(baseUploadDir, "videos");

[baseUploadDir, imageDir, videoDir].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Storage config
const storage = multer.diskStorage({
  destination(req, file, cb) {
    if (file.mimetype.startsWith("image")) {
      cb(null, imageDir);
    } else if (file.mimetype.startsWith("video")) {
      cb(null, videoDir);
    } else {
      cb(new Error("Invalid file type"), false);
    }
  },
  filename(req, file, cb) {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9,
    )}${path.extname(file.originalname)}`;

    cb(null, uniqueName);
  },
});

// File filter (images + videos)
function fileFilter(req, file, cb) {
  const allowedImageTypes = /jpg|jpeg|png|webp/;
  const allowedVideoTypes = /mp4|mov|avi|mkv/;

  const ext = path.extname(file.originalname).toLowerCase();
  const isImage =
    file.mimetype.startsWith("image") && allowedImageTypes.test(ext);
  const isVideo =
    file.mimetype.startsWith("video") && allowedVideoTypes.test(ext);

  if (isImage || isVideo) {
    cb(null, true);
  } else {
    cb(new Error("Only images and videos are allowed"));
  }
}

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB max (for videos)
  },
  fileFilter,
});

export default upload;

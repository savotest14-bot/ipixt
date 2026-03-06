const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const sharp = require("sharp");
const { PDFDocument, degrees } = require("pdf-lib");

const BASE_UPLOAD_PATH = path.join(__dirname, "..", "uploads");
const ORIGINAL_BASE_PATH = path.join(BASE_UPLOAD_PATH, "originals");

const UPLOAD_PATHS = Object.freeze({
    userImg: "users",
    image: "categories",
    subImage:"subCategories",
    mediaPhoto: "items/images",
    mediaVideo: "items/videos",
    mediaAudio: "items/audios",
    mediaDocument: "items/documents",
    profilePic: "profilePics",
    logo: "logo",
    chatMedia: "chat",
});

const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};



// ================= MULTER STORAGE =================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const folder = UPLOAD_PATHS[file.fieldname];

        if (!folder) {
            return cb(new Error("Invalid upload field"));
        }

        const fullPath = path.join(BASE_UPLOAD_PATH, folder);
        ensureDir(fullPath);

        cb(null, fullPath);
    },

    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        const filename = `${crypto.randomUUID()}${ext}`;
        const folder = UPLOAD_PATHS[file.fieldname];

        const fullPath = path.join(BASE_UPLOAD_PATH, folder);
        const finalPath = path.join(fullPath, filename);

        cb(null, filename);
    },
});



// ================= MIME VALIDATION =================

const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/jpg",
    "image/svg+xml",
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/aac",
    "audio/x-wav",
    "application/pdf",
    "text/plain",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error("Unsupported file type"), false);
    }
    cb(null, true);
};

const upload = multer({
    storage,
    fileFilter,
});

module.exports = { upload };
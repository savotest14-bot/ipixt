const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
 
const BASE_UPLOAD_PATH = path.join(__dirname, "..", "uploads");
 
const UPLOAD_PATHS = Object.freeze({
    userImg: "users",
    image: "categories",
    productImage: "products",
    csvFile: "products",
    logo: "logo",
});
 
const ensureDir = (dir) => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
};
 
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
        cb(null, filename);
    },
});
 
const ALLOWED_MIME_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/svg+xml",
    "text/csv",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
 
const fileFilter = (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        return cb(new Error("Unsupported file type"), false);
    }
    cb(null, true);
};
 
const upload = multer({
    storage,
    fileFilter
});
 
module.exports = { upload };
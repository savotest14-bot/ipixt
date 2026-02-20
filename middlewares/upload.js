// const multer = require("multer");
// const path = require("path");
// const crypto = require("crypto");
// const fs = require("fs");
// const sharp = require("sharp");
// const { PDFDocument, rgb, degrees } = require("pdf-lib");

// const BASE_UPLOAD_PATH = path.join(__dirname, "..", "uploads");

// const UPLOAD_PATHS = Object.freeze({
//     userImg: "users",
//     image: "categories",
//     mediaPhoto: "items/images",
//     mediaVideo: "items/videos",
//     mediaAudio: "items/audios",
//     mediaDocument: "items/documents",
//     profilePic:"profilePics",
//     logo: "logo",
//     chatMedia: "chat",
// });

// const ensureDir = (dir) => {
//     if (!fs.existsSync(dir)) {
//         fs.mkdirSync(dir, { recursive: true });
//     }
// };

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         const folder = UPLOAD_PATHS[file.fieldname];

//         if (!folder) {
//             return cb(new Error("Invalid upload field"));
//         }

//         const fullPath = path.join(BASE_UPLOAD_PATH, folder);
//         ensureDir(fullPath);

//         cb(null, fullPath);
//     },

//     filename: (req, file, cb) => {
//         const ext = path.extname(file.originalname).toLowerCase();
//         const filename = `${crypto.randomUUID()}${ext}`;
//         cb(null, filename);
//     },
// });

// const ALLOWED_MIME_TYPES = new Set([
//   // Images
//   "image/jpeg",
//   "image/png",
//   "image/webp",
//   "image/gif",
//   "image/jpg",
//   "image/svg+xml",

//   // Videos
//   "video/mp4",
//   "video/webm",
//   "video/ogg",
//   "video/quicktime", 

//   //Audio
//   "audio/mpeg",     
//   "audio/wav",
//   "audio/ogg",
//   "audio/mp4",       
//   "audio/aac",
//   "audio/x-wav",

//   //Documents
//   "application/pdf",
//   "text/plain",   
//   "text/csv",

//   //Excel / Sheets
//   "application/vnd.ms-excel", 
//   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 

//   //Word
//   "application/msword", 
//   "application/vnd.openxmlformats-officedocument.wordprocessingml.document", 

//   //PowerPoint
//   "application/vnd.ms-powerpoint", 
//   "application/vnd.openxmlformats-officedocument.presentationml.presentation" 
// ]);


// const fileFilter = (req, file, cb) => {
//     if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
//         return cb(new Error("Unsupported file type"), false);
//     }
//     cb(null, true);
// };

// const upload = multer({
//     storage,
//     fileFilter
// });

// module.exports = { upload };

/*****************************************************************************************NEWONE******************************************************************************** */

// with watermarking and pdf support
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



// ================= WATERMARK FUNCTIONS =================

// 🔥 IMAGE WATERMARK (Premium Text Style)
const addImageWatermark = async (filePath) => {
    try {
        const image = sharp(filePath);
        const metadata = await image.metadata();
        const baseImage = await image.toBuffer();

        const fontSize = Math.floor(metadata.width * 0.06);
        const gapX = metadata.width / 2.5;
        const gapY = metadata.height / 2.5;

        let svgContent = `<svg width="${metadata.width}" height="${metadata.height}">`;

        for (let y = 0; y < metadata.height + gapY; y += gapY) {
            for (let x = 0; x < metadata.width + gapX; x += gapX) {

                svgContent += `
                    <text x="${x+3}" y="${y+3}"
                        fill="rgba(0,0,0,0.25)"
                        font-size="${fontSize}"
                        font-weight="600"
                        letter-spacing="3"
                        font-family="Arial"
                        transform="rotate(-30 ${x} ${y})">
                        IPIXIT
                    </text>

                    <text x="${x}" y="${y}"
                        fill="rgba(200,200,200,0.18)"
                        font-size="${fontSize}"
                        font-weight="600"
                        letter-spacing="3"
                        font-family="Arial"
                        transform="rotate(-30 ${x} ${y})">
                        IPIXIT
                    </text>
                `;
            }
        }

        svgContent += `</svg>`;

        await sharp(baseImage)
            .composite([{ input: Buffer.from(svgContent) }])
            .toFile(filePath + "_wm");

        fs.renameSync(filePath + "_wm", filePath);

    } catch (err) {
        console.error("Image watermark error:", err.message);
    }
};


// 🔥 PDF WATERMARK
const addPdfWatermark = async (filePath) => {
    try {
        const existingPdfBytes = fs.readFileSync(filePath);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
            const { width, height } = page.getSize();

            const fontSize = width * 0.06;
            const gapX = width / 2.5;
            const gapY = height / 2.5;

            for (let y = 0; y < height + gapY; y += gapY) {
                for (let x = 0; x < width + gapX; x += gapX) {

                    page.drawText("IPIXIT", {
                        x: x + 3,
                        y: y + 3,
                        size: fontSize,
                        opacity: 0.22,
                        rotate: degrees(30),
                    });

                    page.drawText("IPIXIT", {
                        x,
                        y,
                        size: fontSize,
                        opacity: 0.18,
                        rotate: degrees(30),
                    });
                }
            }
        });

        const pdfBytes = await pdfDoc.save();
        fs.writeFileSync(filePath, pdfBytes);

    } catch (err) {
        console.error("PDF watermark error:", err.message);
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

        setTimeout(async () => {
            try {

                // Only apply for image & PDF fields
                if (
                    file.fieldname === "mediaPhoto" ||
                    file.fieldname === "mediaDocument"
                ) {

                    // -------- SAVE ORIGINAL --------
                    const originalFolder = path.join(
                        ORIGINAL_BASE_PATH,
                        folder
                    );

                    ensureDir(originalFolder);

                    const originalPath = path.join(originalFolder, filename);

                    fs.copyFileSync(finalPath, originalPath);

                    // -------- APPLY WATERMARK --------
                    if (
                        file.fieldname === "mediaPhoto" &&
                        file.mimetype.startsWith("image/")
                    ) {
                        await addImageWatermark(finalPath);
                    }

                    if (
                        file.fieldname === "mediaDocument" &&
                        file.mimetype === "application/pdf"
                    ) {
                        await addPdfWatermark(finalPath);
                    }
                }

            } catch (error) {
                console.error("Watermark/original save error:", error.message);
            }
        }, 100);
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
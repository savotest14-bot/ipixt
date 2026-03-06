const fs = require("fs");
const sharp = require("sharp");
const { PDFDocument, degrees } = require("pdf-lib");
const path = require("path");
const BASE_UPLOAD_PATH = path.join(__dirname, "..", "uploads");
const ORIGINAL_BASE_PATH = path.join(BASE_UPLOAD_PATH, "originals");

exports.addImageWatermark = async (filePath) => {
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
exports.addPdfWatermark = async (filePath) => {
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
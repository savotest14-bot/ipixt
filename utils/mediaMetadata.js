const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const mm = require("music-metadata");
const fs = require("fs");
const { PDFDocument } = require("pdf-lib");

const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const ffprobeInstaller = require("@ffprobe-installer/ffprobe");

// set ffmpeg + ffprobe paths
ffmpeg.setFfmpegPath(ffmpegInstaller.path);
ffmpeg.setFfprobePath(ffprobeInstaller.path);


// ---------- HELPER FUNCTION ----------



function getAspectRatio(width, height) {
  const gcd = (a, b) => (b === 0 ? a : gcd(b, a % b));
  const divisor = gcd(width, height);

  return `${width / divisor}:${height / divisor}`;
}

function detectPlatformFormat(width, height) {

  const ratio = width / height;

  if (Math.abs(ratio - 1) < 0.05) {
    return "Instagram Post (1:1)";
  }

  if (Math.abs(ratio - 0.8) < 0.05) {
    return "Instagram Portrait (4:5)";
  }

  if (Math.abs(ratio - 1.777) < 0.05) {
    return "YouTube Landscape (16:9)";
  }

  if (Math.abs(ratio - 0.5625) < 0.05) {
    return "Instagram Reel / YouTube Shorts (9:16)";
  }

  return "Custom Format";
}
// ---------- IMAGE METADATA ----------
exports.getImageMetadata = async (filePath) => {

  const metadata = await sharp(filePath, { failOnError: false }).metadata();

  const width = metadata.width;
  const height = metadata.height;

  return {
    width,
    height,
    resolution: `${width}x${height}`,
    aspectRatio: getAspectRatio(width, height),
    platformFormat: detectPlatformFormat(width, height),
    format: metadata.format,
    size: fs.statSync(filePath).size
  };
};


// ---------- VIDEO METADATA ----------
exports.getVideoMetadata = (filePath) => {
  return new Promise((resolve, reject) => {

    ffmpeg.ffprobe(filePath, (err, metadata) => {

      if (err) return reject(err);

      const videoStream = metadata.streams.find(
        stream => stream.codec_type === "video"
      );

      if (!videoStream) {
        return resolve({});
      }

      const width = videoStream.width;
      const height = videoStream.height;

      resolve({
        width,
        height,
        resolution: `${width}x${height}`,
        aspectRatio: getAspectRatio(width, height),
        platformFormat: detectPlatformFormat(width, height),
        duration: metadata.format.duration,
        format: metadata.format.format_name,
        size: fs.statSync(filePath).size
      });

    });

  });
};


// ---------- AUDIO METADATA ----------
exports.getAudioMetadata = async (filePath) => {

  const metadata = await mm.parseFile(filePath);

  return {
    duration: metadata.format.duration,
    bitrate: metadata.format.bitrate,
    format: metadata.format.container,
    size: fs.statSync(filePath).size
  };

};


// ---------- PDF METADATA ----------
exports.getPdfMetadata = async (filePath) => {

  const pdfBytes = fs.readFileSync(filePath);
  const pdfDoc = await PDFDocument.load(pdfBytes);

  return {
    pages: pdfDoc.getPageCount(),
    size: fs.statSync(filePath).size
  };

};
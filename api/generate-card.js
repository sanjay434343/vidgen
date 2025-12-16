import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { createCanvas, loadImage } from "canvas";

ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

export default async function handler(req, res) {
  // ---------------- CORS ----------------
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "POST only" });
  }

  try {
    const {
      ratio = "16:9",
      text,
      textColor = "#ffffff",
      cardColor = "#000000",
      username = "",
      userProfileImageBase64 = "",
      songTitle = "",
      artist = "",
      songImageBase64 = "",
      musicUrl,
      clipStart,
      clipEnd
    } = req.body || {};

    if (!text || !musicUrl) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const start = Number(clipStart);
    const end = Number(clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.status(400).json({ success: false, error: "Invalid clip range" });
    }

    const duration = Math.min(end - start, 10); // SAFE LIMIT

    const RATIOS = {
      "1:1": { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };
    const { w, h } = RATIOS[ratio] || RATIOS["16:9"];

    const TMP = "/tmp";
    const svgPath = path.join(TMP, "card.svg");
    const pngPath = path.join(TMP, "card.png");
    const audioPath = path.join(TMP, "audio.mp3");
    const videoPath = path.join(TMP, "output.mp4");

    // ---------------- SVG ----------------
    const svg = generateSVG({
      w,
      h,
      text,
      textColor,
      cardColor,
      username,
      userProfileImageBase64,
      songTitle,
      artist,
      songImageBase64
    });
    fs.writeFileSync(svgPath, svg);

    // ---------------- SVG → PNG ----------------
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext("2d");
    const img = await loadImage(`data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`);
    ctx.drawImage(img, 0, 0, w, h);
    fs.writeFileSync(pngPath, canvas.toBuffer("image/png"));

    // ---------------- AUDIO ----------------
    const audioRes = await fetch(musicUrl);
    if (!audioRes.ok) throw new Error("Audio fetch failed");
    fs.writeFileSync(audioPath, Buffer.from(await audioRes.arrayBuffer()));

    // ---------------- FFMPEG ----------------
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(pngPath)
        .inputOptions(["-loop 1"])
        .input(audioPath)
        .setStartTime(start)
        .duration(duration)
        .outputOptions([
          "-pix_fmt yuv420p",
          "-preset ultrafast",
          "-tune stillimage",
          "-movflags +faststart",
          "-shortest"
        ])
        .save(videoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    const videoBase64 = fs.readFileSync(videoPath).toString("base64");

    return res.status(200).json({
      success: true,
      video: `data:video/mp4;base64,${videoBase64}`,
      duration,
      width: w,
      height: h
    });

  } catch (err) {
    console.error("API ERROR:", err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/* ================= SVG ================= */

function generateSVG({
  w, h, text, textColor, cardColor,
  username, userProfileImageBase64,
  songTitle, artist, songImageBase64
}) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${cardColor}"/>
  <text x="50%" y="50%" fill="${textColor}"
    font-size="${Math.round(w * 0.05)}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial"
    font-weight="800">
    ${escapeXml(text)}
  </text>
</svg>`;
}

function escapeXml(str="") {
  return str.replace(/[<>&"]/g, c =>
    ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "\"":"&quot;" }[c])
  );
}

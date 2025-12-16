import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";

ffmpeg.setFfmpegPath(ffmpegPath);

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

export default async function handler(req, res) {
  // ---------- CORS ----------
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
      return res.status(400).json({
        success: false,
        error: "text and musicUrl are required"
      });
    }

    const start = Number(clipStart);
    const end = Number(clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.status(400).json({ error: "Invalid clip range" });
    }

    const duration = end - start;

    const RATIOS = {
      "1:1": { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };
    const { w, h } = RATIOS[ratio] || RATIOS["16:9"];

    // ---------- FILE PATHS ----------
    const TMP = "/tmp";
    const svgPath = path.join(TMP, "card.svg");
    const audioPath = path.join(TMP, "audio.mp3");
    const videoPath = path.join(TMP, "output.mp4");

    // ---------- SVG ----------
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

    // ---------- AUDIO ----------
    const audioRes = await fetch(musicUrl);
    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    fs.writeFileSync(audioPath, audioBuffer);

    // ---------- FFMPEG ----------
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(svgPath)
        .inputOptions([
          "-loop 1"
        ])
        .input(audioPath)
        .setStartTime(start)
        .duration(duration)
        .outputOptions([
          "-pix_fmt yuv420p",
          "-preset ultrafast",
          "-shortest",
          `-vf scale=${w}:${h}`
        ])
        .save(videoPath)
        .on("end", resolve)
        .on("error", reject);
    });

    // ---------- RETURN VIDEO ----------
    const videoBase64 = fs.readFileSync(videoPath).toString("base64");

    res.status(200).json({
      success: true,
      video: `data:video/mp4;base64,${videoBase64}`,
      width: w,
      height: h,
      duration
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

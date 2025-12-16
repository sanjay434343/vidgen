import fetch from "node-fetch";

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
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const {
      text,
      textColor = "#ffffff",
      cardColor = "#000000",
      songTitle = "",
      artist = "",
      songImage = "",
      musicUrl,
      clipStart,
      clipEnd,
      ratio = "16:9"   // NEW
    } = req.body || {};

    if (!text || !musicUrl) {
      return res.status(400).json({ error: "text and musicUrl required" });
    }

    const start = Number(clipStart ?? 0);
    const end = Number(clipEnd ?? 0);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.status(400).json({ error: "Invalid clipStart / clipEnd" });
    }

    const clipDuration = end - start;

    // ---------------- RATIO CONFIG ----------------
    const RATIO_MAP = {
      "1:1":  { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };

    const { w, h } = RATIO_MAP[ratio] || RATIO_MAP["16:9"];

    // ---------------- SVG ----------------
    const svg = generateSVG({
      w, h,
      text,
      textColor,
      cardColor,
      songTitle,
      artist,
      songImage,
      clipStart: start,
      clipEnd: end
    });

    // ---------------- AUDIO ----------------
    const audioRes = await fetch(musicUrl);
    if (!audioRes.ok) {
      return res.status(400).json({ error: "Failed to fetch audio" });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const mime = getMimeType(musicUrl);

    return res.json({
      success: true,
      svg,
      audio: `data:${mime};base64,${audioBuffer.toString("base64")}`,
      clipStart: start,
      clipEnd: end,
      clipDuration,
      width: w,
      height: h
    });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

/* ===================================================== */

function generateSVG({
  w, h,
  text,
  textColor,
  cardColor,
  songTitle,
  artist,
  songImage,
  clipStart,
  clipEnd
}) {
  const centerX = w / 2;
  const centerY = h * 0.45;

  const coverSize = Math.min(w, h) * 0.13;
  const coverX = w * 0.06;
  const coverY = h - coverSize - h * 0.06;

  const textX = coverX + coverSize + 30;
  const titleY = coverY + 45;
  const artistY = coverY + 85;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${cardColor}" />

  <!-- MAIN TEXT -->
  <text
    x="${centerX}"
    y="${centerY}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.045)}"
    font-weight="700"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    dominant-baseline="middle"
  >
    ${escapeXml(text)}
  </text>

  <!-- SONG IMAGE -->
  ${songImage ? `
  <image
    href="${songImage}"
    x="${coverX}"
    y="${coverY}"
    width="${coverSize}"
    height="${coverSize}"
    preserveAspectRatio="xMidYMid slice"
  />` : ""}

  <!-- SONG TITLE -->
  <text
    x="${textX}"
    y="${titleY}"
    fill="#ffffff"
    font-size="${Math.round(w * 0.018)}"
    font-weight="600"
    font-family="Arial, sans-serif"
  >
    ${escapeXml(songTitle)}
  </text>

  <!-- ARTIST -->
  <text
    x="${textX}"
    y="${artistY}"
    fill="#94a3b8"
    font-size="${Math.round(w * 0.014)}"
    font-family="Arial, sans-serif"
  >
    ${escapeXml(artist)}
  </text>

  <!-- CLIP INFO -->
  <text
    x="${w - 20}"
    y="${h - 20}"
    fill="#94a3b8"
    font-size="${Math.round(w * 0.012)}"
    font-family="Arial, sans-serif"
    text-anchor="end"
  >
    ${clipStart}s – ${clipEnd}s
  </text>
</svg>`;
}

/* ===================================================== */

function escapeXml(str = "") {
  return str.replace(/[<>&"]/g, c =>
    ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "\"":"&quot;" }[c])
  );
}

function getMimeType(url) {
  const ext = url.split(".").pop().toLowerCase().split("?")[0];
  return {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4"
  }[ext] || "audio/mpeg";
}

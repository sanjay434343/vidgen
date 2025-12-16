import fetch from "node-fetch";

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
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const {
      ratio = "16:9",
      text,
      textColor = "#ffffff",
      cardColor = "#000000",
      songTitle = "",
      artist = "",
      songImage = "",
      musicUrl,
      clipStart,
      clipEnd
    } = req.body || {};

    if (!text || !musicUrl) {
      return res.status(400).json({ error: "text and musicUrl required" });
    }

    const start = Number(clipStart);
    const end = Number(clipEnd);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.status(400).json({ error: "Invalid clip range" });
    }

    const clipDuration = end - start;

    const RATIOS = {
      "1:1": { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };

    const { w, h } = RATIOS[ratio] || RATIOS["16:9"];

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

    // Fetch audio (full audio – clipping is client-side)
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

/* ---------- SVG ---------- */

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
  const cx = w / 2;
  const cy = h * 0.45;
  const cover = Math.min(w, h) * 0.13;
  const pad = Math.min(w, h) * 0.06;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${cardColor}" />

  <text
    x="${cx}"
    y="${cy}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.045)}"
    font-weight="700"
    font-family="Arial, sans-serif"
    text-anchor="middle"
    dominant-baseline="middle"
  >
    ${escapeXml(text)}
  </text>

  ${songImage ? `
  <image
    href="${songImage}"
    x="${pad}"
    y="${h - cover - pad}"
    width="${cover}"
    height="${cover}"
    preserveAspectRatio="xMidYMid slice"
  />` : ""}

  <text
    x="${pad + cover + 30}"
    y="${h - cover - pad + 45}"
    fill="#ffffff"
    font-size="${Math.round(w * 0.018)}"
    font-weight="600"
    font-family="Arial"
  >${escapeXml(songTitle)}</text>

  <text
    x="${pad + cover + 30}"
    y="${h - cover - pad + 85}"
    fill="#94a3b8"
    font-size="${Math.round(w * 0.014)}"
    font-family="Arial"
  >${escapeXml(artist)}</text>

  <text
    x="${w - 20}"
    y="${h - 20}"
    fill="#94a3b8"
    font-size="${Math.round(w * 0.012)}"
    text-anchor="end"
    font-family="Arial"
  >${clipStart}s – ${clipEnd}s</text>
</svg>`;
}

function escapeXml(str = "") {
  return str.replace(/[<>&"]/g, c =>
    ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "\"":"&quot;" }[c])
  );
}

function getMimeType(url) {
  const ext = url.split(".").pop().toLowerCase();
  return {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4"
  }[ext] || "audio/mpeg";
}

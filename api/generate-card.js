import fetch from "node-fetch";

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

export default async function handler(req, res) {
  // -------- CORS --------
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

      uid = "",
      username = "",
      userProfileImage = "",

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

      uid,
      username,
      userProfileImage,

      songTitle,
      artist,
      songImage,

      clipStart: start,
      clipEnd: end
    });

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

/* ================= SVG ================= */

function generateSVG({
  w, h,
  text,
  textColor,
  cardColor,

  uid,
  username,
  userProfileImage,

  songTitle,
  artist,
  songImage,

  clipStart,
  clipEnd
}) {
  const safe = Math.min(w, h) * 0.05;
  const avatar = Math.min(w, h) * 0.09;
  const songSize = Math.min(w, h) * 0.12;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <clipPath id="userCircle">
      <circle cx="${avatar / 2}" cy="${avatar / 2}" r="${avatar / 2}" />
    </clipPath>
    <clipPath id="songCircle">
      <circle cx="${songSize / 2}" cy="${songSize / 2}" r="${songSize / 2}" />
    </clipPath>
  </defs>

  <!-- BACKGROUND -->
  <rect width="100%" height="100%" fill="${cardColor}" />

  <!-- USER TOP LEFT -->
  ${userProfileImage ? `
  <image
    href="${userProfileImage}"
    x="${safe}"
    y="${safe}"
    width="${avatar}"
    height="${avatar}"
    clip-path="url(#userCircle)"
  />` : ""}

  <text
    x="${safe + avatar + 14}"
    y="${safe + avatar / 2}"
    fill="#ffffff"
    font-size="${Math.round(w * 0.02)}"
    font-family="Arial, sans-serif"
    font-weight="600"
    dominant-baseline="middle">
    ${escapeXml(username || uid)}
  </text>

  <!-- MAIN TEXT CENTER -->
  <text
    x="${w / 2}"
    y="${h / 2}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.045)}"
    font-family="Arial, sans-serif"
    font-weight="700"
    text-anchor="middle"
    dominant-baseline="middle">
    ${escapeXml(text)}
  </text>

  <!-- SONG BOTTOM LEFT -->
  ${songImage ? `
  <image
    href="${songImage}"
    x="${safe}"
    y="${h - songSize - safe}"
    width="${songSize}"
    height="${songSize}"
    clip-path="url(#songCircle)"
  />` : ""}

  <text
    x="${safe + songSize + 14}"
    y="${h - songSize - safe + 42}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.018)}"
    font-family="Arial, sans-serif"
    font-weight="600">
    ${escapeXml(songTitle)}
  </text>

  <text
    x="${safe + songSize + 14}"
    y="${h - songSize - safe + 78}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.014)}"
    font-family="Arial, sans-serif">
    ${escapeXml(artist)}
  </text>

  <!-- CLIP INFO -->
  <text
    x="${w - safe}"
    y="${h - safe}"
    text-anchor="end"
    fill="#94a3b8"
    font-size="${Math.round(w * 0.012)}"
    font-family="Arial, sans-serif">
    ${clipStart}s – ${clipEnd}s
  </text>
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

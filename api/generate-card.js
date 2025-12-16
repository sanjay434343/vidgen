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
    return res.status(405).json({ success: false, error: "POST only" });
  }

  try {
    const body = req.body || {};

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
    } = body;

    if (!text || !musicUrl) {
      return res.status(400).json({
        success: false,
        error: "text and musicUrl are required"
      });
    }

    const start = Number(clipStart);
    const end = Number(clipEnd);

    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return res.status(400).json({
        success: false,
        error: "Invalid clip range"
      });
    }

    const clipDuration = end - start;

    const RATIOS = {
      "1:1":  { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };

    const { w, h } = RATIOS[ratio] || RATIOS["16:9"];

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

    // -------- AUDIO FETCH --------
    const audioRes = await fetch(musicUrl);
    if (!audioRes.ok) {
      return res.status(400).json({
        success: false,
        error: "Failed to fetch audio"
      });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());
    const mime = getMimeType(musicUrl);

    return res.status(200).json({
      success: true,
      svg,
      audio: `data:${mime};base64,${audioBuffer.toString("base64")}`,
      clipStart: start,
      clipDuration,
      width: w,
      height: h
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      error: err.message
    });
  }
}

/* ================= SVG ================= */

function generateSVG({
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
}) {
  const safe = Math.min(w, h) * 0.05;
  const avatar = Math.min(w, h) * 0.09;
  const songSize = Math.min(w, h) * 0.12;

  const userLeft = safe * 2.2;
  const songLeft = safe;

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <clipPath id="userCircle">
      <circle cx="${userLeft + avatar / 2}" cy="${safe + avatar / 2}" r="${avatar / 2}" />
    </clipPath>
    <clipPath id="songCircle">
      <circle cx="${songLeft + songSize / 2}" cy="${h - songSize - safe + songSize / 2}" r="${songSize / 2}" />
    </clipPath>
  </defs>

  <rect width="100%" height="100%" fill="${cardColor}" />

  ${
    userProfileImageBase64
      ? `<image href="${userProfileImageBase64}"
          x="${userLeft}" y="${safe}"
          width="${avatar}" height="${avatar}"
          clip-path="url(#userCircle)" preserveAspectRatio="xMidYMid slice" />`
      : ""
  }

  <text
    x="${userLeft + avatar + 14}"
    y="${safe + avatar / 2}"
    fill="#ffffff"
    font-size="${Math.round(w * 0.02)}"
    dominant-baseline="middle"
    font-family="Arial"
    font-weight="600">
    ${escapeXml(username)}
  </text>

  <text
    x="${w / 2}"
    y="${h / 2}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.045)}"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="Arial"
    font-weight="700">
    ${escapeXml(text)}
  </text>

  ${
    songImageBase64
      ? `<image href="${songImageBase64}"
          x="${songLeft}" y="${h - songSize - safe}"
          width="${songSize}" height="${songSize}"
          clip-path="url(#songCircle)" preserveAspectRatio="xMidYMid slice" />`
      : ""
  }

  <text
    x="${songLeft + songSize + 14}"
    y="${h - songSize - safe + songSize * 0.35}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.018)}"
    font-family="Arial"
    font-weight="600">
    ${escapeXml(songTitle)}
  </text>

  <text
    x="${songLeft + songSize + 14}"
    y="${h - songSize - safe + songSize * 0.65}"
    fill="${textColor}"
    font-size="${Math.round(w * 0.014)}"
    font-family="Arial">
    ${escapeXml(artist)}
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

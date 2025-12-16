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
      clipStart = 0,
      clipDuration = 15
    } = req.body || {};

    if (!text || !musicUrl) {
      return res.status(400).json({ error: "Text and musicUrl required" });
    }

    // ---------------- SVG GENERATION ----------------
    const svg = generateSVG({
      text,
      textColor,
      cardColor,
      songTitle,
      artist,
      songImage
    });

    // ---------------- AUDIO FETCH ----------------
    const audioRes = await fetch(musicUrl);
    if (!audioRes.ok) {
      return res.status(400).json({ error: "Failed to fetch audio" });
    }

    const audioBuffer = Buffer.from(await audioRes.arrayBuffer());

    // ⚠️ NOTE:
    // True audio clipping requires FFmpeg (not allowed on Vercel).
    // So we return full audio + metadata for client-side clipping.
    // This is the ONLY safe approach on Vercel.

    const mime = getMimeType(musicUrl);

    return res.json({
      success: true,
      svg,
      audio: `data:${mime};base64,${audioBuffer.toString("base64")}`,
      clipStart,
      clipDuration
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal error",
      detail: err.message
    });
  }
}

/* ---------------- HELPERS ---------------- */

function generateSVG({
  text,
  textColor,
  cardColor,
  songTitle,
  artist,
  songImage
}) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <rect width="100%" height="100%" fill="${cardColor}" />

  <!-- MAIN TEXT -->
  <text
    x="960"
    y="520"
    fill="${textColor}"
    font-size="90"
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
    x="80"
    y="820"
    width="140"
    height="140"
    preserveAspectRatio="xMidYMid slice"
  />` : ""}

  <!-- SONG TITLE -->
  <text
    x="250"
    y="880"
    fill="#ffffff"
    font-size="36"
    font-family="Arial, sans-serif"
    font-weight="600"
  >
    ${escapeXml(songTitle)}
  </text>

  <!-- ARTIST -->
  <text
    x="250"
    y="930"
    fill="#94a3b8"
    font-size="28"
    font-family="Arial, sans-serif"
  >
    ${escapeXml(artist)}
  </text>
</svg>
`;
}

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

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
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { text, textColor, cardColor, musicUrl } = req.body || {};

    if (!text || !textColor || !cardColor || !musicUrl) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // -------- SVG FRAME (CENTERED TEXT) --------
    const svgFrame = createSVGFrame(text, textColor, cardColor);

    // -------- FETCH MUSIC --------
    const musicRes = await fetch(musicUrl);
    if (!musicRes.ok) {
      return res.status(400).json({ error: "Failed to fetch music file" });
    }

    const buffer = Buffer.from(await musicRes.arrayBuffer());
    const mime = getMimeType(musicUrl);
    const musicBase64 = buffer.toString("base64");

    // -------- RESPONSE --------
    return res.status(200).json({
      success: true,
      svgFrame,
      musicData: `data:${mime};base64,${musicBase64}`
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "Internal server error",
      detail: err.message
    });
  }
}

/* ---------------- HELPERS ---------------- */

function createSVGFrame(text, textColor, cardColor) {
  const maxWidth = 1500;
  const words = text.split(" ");
  const lines = [];
  let line = "";

  words.forEach(word => {
    const test = line + word + " ";
    if (test.length * 40 > maxWidth) {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = test;
    }
  });
  lines.push(line.trim());

  const lineHeight = 100;
  const startY = 540 - ((lines.length - 1) * lineHeight) / 2;

  const textSVG = lines.map((l, i) => `
    <text
      x="960"
      y="${startY + i * lineHeight}"
      fill="${textColor}"
      font-size="80"
      font-weight="bold"
      font-family="Arial, sans-serif"
      text-anchor="middle"
      dominant-baseline="middle"
    >${escapeXml(l)}</text>
  `).join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <rect width="100%" height="100%" fill="${cardColor}" />
  ${textSVG}
</svg>
`;
}

function escapeXml(str) {
  return str.replace(/[<>&"]/g, c => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    "\"": "&quot;"
  }[c]));
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

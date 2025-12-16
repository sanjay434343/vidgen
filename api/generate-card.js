import { createCanvas } from "@napi-rs/canvas";

export const config = {
  runtime: "nodejs"
};

export default async function handler(req, res) {
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
      bgColor = "#020617",
      textColor = "#ffffff",
      fontSize = 64,
      musicUrl = ""
    } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const width = 1080;
    const height = 1920;

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // ---------- Background ----------
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // ---------- Text Settings ----------
    ctx.font = `700 ${fontSize}px system-ui`;
    ctx.fillStyle = textColor;
    ctx.textAlign = "center";
    ctx.textBaseline = "alphabetic";

    // Optional: improve visibility
    ctx.shadowColor = "rgba(0,0,0,0.35)";
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 4;

    // ---------- Wrap text ----------
    const maxWidth = width * 0.82;
    const lineHeight = fontSize * 1.35;
    const lines = getWrappedLines(ctx, text, maxWidth);

    // ---------- TRUE vertical centering ----------
    const totalTextHeight = lines.length * lineHeight;
    let y = (height - totalTextHeight) / 2 + fontSize;

    lines.forEach(line => {
      ctx.fillText(line, width / 2, y);
      y += lineHeight;
    });

    const buffer = canvas.toBuffer("image/png");
    const base64 = buffer.toString("base64");

    return res.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
      music: musicUrl,
      duration: 8
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to generate card" });
  }
}

/* ---------- Helpers ---------- */

function getWrappedLines(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const { width } = ctx.measureText(testLine);

    if (width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = words[i] + " ";
    } else {
      line = testLine;
    }
  }

  lines.push(line.trim());
  return lines;
}

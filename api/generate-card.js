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

    const WIDTH = 1080;
    const HEIGHT = 1920;

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    /* ---------- Background ---------- */
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    /* ---------- Text Setup ---------- */
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // IMPORTANT: remove all shadows & offsets
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    /* ---------- Text Wrapping ---------- */
    const maxWidth = WIDTH * 0.8;
    const lineHeight = fontSize * 1.3;
    const lines = wrapText(ctx, text, maxWidth);

    /* ---------- PERFECT CENTER ---------- */
    const totalHeight = lines.length * lineHeight;
    let startY = (HEIGHT / 2) - (totalHeight / 2) + (lineHeight / 2);

    lines.forEach((line, i) => {
      ctx.fillText(
        line,
        WIDTH / 2,
        startY + i * lineHeight
      );
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

/* ---------- Helper ---------- */
function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i] + " ";
    const metrics = ctx.measureText(testLine);

    if (metrics.width > maxWidth && i > 0) {
      lines.push(line.trim());
      line = words[i] + " ";
    } else {
      line = testLine;
    }
  }

  lines.push(line.trim());
  return lines;
}

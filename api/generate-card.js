import { createCanvas } from "@napi-rs/canvas";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST")
    return res.status(405).json({ error: "POST only" });

  try {
    const {
      text = "Hello World",
      bgColor = "#111827",
      textColor = "#ffffff",
      fontSize = 64,
      musicUrl = ""
    } = req.body || {};

    // Canvas setup
    const width = 1080;
    const height = 1920;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext("2d");

    // Background
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Text
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px system-ui`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    wrapText(ctx, text, width / 2, height / 2, width - 160, fontSize + 12);

    // Export image
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
    return res.status(500).json({ error: "Image generation failed" });
  }
}

// Word wrap helper
function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let lines = [];

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + " ";
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      lines.push(line);
      line = words[n] + " ";
    } else {
      line = testLine;
    }
  }
  lines.push(line);

  const startY = y - (lines.length * lineHeight) / 2;
  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
}

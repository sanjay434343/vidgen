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
      bgColor = "#ffffff",
      textColor = "#ff0000",
      fontSize = 72,
      musicUrl = ""
    } = req.body || {};

    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    const WIDTH = 1080;
    const HEIGHT = 1920;

    const canvas = createCanvas(WIDTH, HEIGHT);
    const ctx = canvas.getContext("2d");

    // ---------- BACKGROUND ----------
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // ---------- TEXT (GUARANTEED VISIBLE) ----------
    ctx.fillStyle = textColor;
    ctx.font = `${fontSize}px sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(text, WIDTH / 2, HEIGHT / 2);

    const buffer = canvas.toBuffer("image/png");
    const base64 = buffer.toString("base64");

    return res.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
      music: musicUrl
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Render failed" });
  }
}

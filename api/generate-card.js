import fetch from "node-fetch";

export default async function handler(req, res) {
  // CORS
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { text, textColor, cardColor, musicUrl } = req.body || {};

    if (!text || !textColor || !cardColor || !musicUrl) {
      return res.status(400).json({ error: "Missing fields" });
    }

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">
  <rect width="100%" height="100%" fill="${cardColor}" />
  <text
    x="960"
    y="540"
    fill="${textColor}"
    font-size="80"
    font-family="Arial, sans-serif"
    font-weight="bold"
    text-anchor="middle"
    dominant-baseline="middle"
  >${escapeXml(text)}</text>
</svg>`;

    const r = await fetch(musicUrl);
    if (!r.ok) {
      return res.status(400).json({ error: "Invalid music URL" });
    }

    const buf = Buffer.from(await r.arrayBuffer());
    const audioBase64 = buf.toString("base64");

    return res.json({
      success: true,
      svg,
      audio: `data:audio/mpeg;base64,${audioBase64}`
    });

  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function escapeXml(str) {
  return str.replace(/[<>&"]/g, c =>
    ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "\"":"&quot;" }[c])
  );
}

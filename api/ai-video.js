import fetch from "node-fetch";

export const config = {
  runtime: "nodejs",
  maxDuration: 60
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.end();
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const { ratio = "9:16", theme, user, song, pages } = req.body;

    if (!pages?.length || !song?.musicUrl) {
      return res.status(400).json({ error: "Invalid input" });
    }

    const RATIOS = {
      "1:1": { w: 1080, h: 1080 },
      "9:16": { w: 1080, h: 1920 },
      "16:9": { w: 1920, h: 1080 }
    };
    const { w, h } = RATIOS[ratio] || RATIOS["9:16"];

    const frames = pages.map((page, index) => ({
      index,
      duration: page.duration || 4,
      svg: generateSVG({
        w,
        h,
        page,
        theme,
        user,
        song
      })
    }));

    const audioRes = await fetch(song.musicUrl);
    const audioBuf = Buffer.from(await audioRes.arrayBuffer());

    res.json({
      success: true,
      width: w,
      height: h,
      frames,
      audio: `data:audio/mpeg;base64,${audioBuf.toString("base64")}`,
      clipDuration: song.clipEnd - song.clipStart
    });

  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
}

/* ================= SVG PAGE ================= */

function generateSVG({ w, h, page, theme, user, song }) {
  const imgSize = w * 0.28;
  const gap = w * 0.04;

  const images = (page.images || []).slice(0, 3);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <rect width="100%" height="100%" fill="${theme.cardColor}" />

  <text x="${w/2}" y="${h*0.18}"
        fill="${theme.textColor}"
        font-size="${w*0.06}"
        font-weight="800"
        text-anchor="middle">
    ${escapeXml(page.text || "")}
  </text>

  ${images.map((img, i) => `
    <image href="${img}"
      x="${w/2 - ((images.length-1)/2 - i)*(imgSize+gap) - imgSize/2}"
      y="${h*0.28}"
      width="${imgSize}"
      height="${imgSize}"
      preserveAspectRatio="xMidYMid slice"
      rx="${imgSize*0.12}" />
  `).join("")}

  <text x="${w*0.12}" y="${h*0.95}"
        fill="${theme.textColor}"
        font-size="${w*0.03}">
    ${escapeXml(song.title)} — ${escapeXml(song.artist)}
  </text>
</svg>`;
}

function escapeXml(str="") {
  return str.replace(/[<>&"]/g, c =>
    ({ "<":"&lt;", ">":"&gt;", "&":"&amp;", "\"":"&quot;" }[c])
  );
}

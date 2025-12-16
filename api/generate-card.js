import fetch from 'node-fetch';

export const config = {
  maxDuration: 60,
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { text, textColor, cardColor, musicUrl } = req.body;

    if (!text || !textColor || !cardColor || !musicUrl) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // For Vercel serverless, we'll use a hybrid approach:
    // 1. Generate frames as data URLs
    // 2. Return instructions for client-side video assembly
    
    // Create SVG frame (works without canvas)
    const svgFrame = createSVGFrame(text, textColor, cardColor);
    
    // Download music
    let musicBuffer;
    try {
      const musicResponse = await fetch(musicUrl);
      if (!musicResponse.ok) {
        throw new Error('Failed to download music');
      }
      musicBuffer = await musicResponse.buffer();
    } catch (error) {
      return res.status(400).json({ error: 'Failed to download music file. Please check the URL.' });
    }

    // Convert music to base64
    const musicBase64 = musicBuffer.toString('base64');
    const musicMimeType = getMimeType(musicUrl);

    // Return data for client-side video generation
    res.status(200).json({
      success: true,
      svgFrame,
      musicData: `data:${musicMimeType};base64,${musicBase64}`,
      message: 'Data ready for video generation'
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ 
      error: 'Failed to process request', 
      details: error.message 
    });
  }
}

function createSVGFrame(text, textColor, cardColor) {
  // Wrap text to fit within bounds
  const maxWidth = 1700;
  const words = text.split(' ');
  const lines = [];
  let currentLine = words[0] || '';

  for (let i = 1; i < words.length; i++) {
    const testLine = currentLine + ' ' + words[i];
    // Rough estimate: 40px per character at 80px font
    if (testLine.length * 40 > maxWidth) {
      lines.push(currentLine);
      currentLine = words[i];
    } else {
      currentLine = testLine;
    }
  }
  lines.push(currentLine);

  const lineHeight = 100;
  const startY = 540 - ((lines.length - 1) * lineHeight) / 2;

  let textElements = '';
  lines.forEach((line, i) => {
    const y = startY + i * lineHeight;
    textElements += `<text x="960" y="${y}" fill="${textColor}" font-size="80" font-weight="bold" font-family="Arial, sans-serif" text-anchor="middle" dominant-baseline="middle">${escapeXml(line)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080" viewBox="0 0 1920 1080">
    <rect width="1920" height="1080" fill="${cardColor}"/>
    ${textElements}
  </svg>`;
}

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, (c) => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function getMimeType(url) {
  const ext = url.split('.').pop().toLowerCase().split('?')[0];
  const mimeTypes = {
    'mp3': 'audio/mpeg',
    'wav': 'audio/wav',
    'ogg': 'audio/ogg',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac'
  };
  return mimeTypes[ext] || 'audio/mpeg';
}

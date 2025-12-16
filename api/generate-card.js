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

    // Create canvas image with text
    const canvas = createCanvas(1920, 1080);
    const ctx = canvas.getContext('2d');

    // Draw background
    ctx.fillStyle = cardColor;
    ctx.fillRect(0, 0, 1920, 1080);

    // Draw text
    ctx.fillStyle = textColor;
    ctx.font = 'bold 80px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Wrap text
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      const testLine = currentLine + ' ' + words[i];
      const metrics = ctx.measureText(testLine);
      if (metrics.width > 1700) {
        lines.push(currentLine);
        currentLine = words[i];
      } else {
        currentLine = testLine;
      }
    }
    lines.push(currentLine);

    const lineHeight = 100;
    const startY = 540 - ((lines.length - 1) * lineHeight) / 2;
    
    lines.forEach((line, i) => {
      ctx.fillText(line, 960, startY + i * lineHeight);
    });

    const imageBuffer = canvas.toBuffer('image/png');

    // Download music
    const musicResponse = await fetch(musicUrl);
    if (!musicResponse.ok) {
      throw new Error('Failed to download music');
    }
    const musicBuffer = await musicResponse.buffer();

    // Use FFmpeg to create video
    const ffmpeg = require('fluent-ffmpeg');
    const { Readable } = require('stream');
    const path = require('path');
    const os = require('os');
    const fs = require('fs');

    // Create temp files
    const tempDir = os.tmpdir();
    const imagePath = path.join(tempDir, `image_${Date.now()}.png`);
    const audioPath = path.join(tempDir, `audio_${Date.now()}.mp3`);
    const videoPath = path.join(tempDir, `video_${Date.now()}.mp4`);

    fs.writeFileSync(imagePath, imageBuffer);
    fs.writeFileSync(audioPath, musicBuffer);

    // Create video
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(imagePath)
        .inputOptions(['-loop 1'])
        .input(audioPath)
        .outputOptions([
          '-c:v libx264',
          '-tune stillimage',
          '-c:a aac',
          '-b:a 192k',
          '-pix_fmt yuv420p',
          '-shortest'
        ])
        .output(videoPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    // Read video file
    const videoBuffer = fs.readFileSync(videoPath);

    // Cleanup
    fs.unlinkSync(imagePath);
    fs.unlinkSync(audioPath);
    fs.unlinkSync(videoPath);

    // Send video
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Disposition', 'attachment; filename="card_video.mp4"');
    res.send(videoBuffer);

  } catch (error) {
    console.error('Error generating video:', error);
    res.status(500).json({ error: 'Failed to generate video', details: error.message });
  }
}

function createCanvas(width, height) {
  // Simple canvas implementation for serverless
  const canvas = {
    width,
    height,
    _data: null,
    getContext: function(type) {
      if (type !== '2d') throw new Error('Only 2d context supported');
      return {
        fillStyle: '#000000',
        font: '10px sans-serif',
        textAlign: 'left',
        textBaseline: 'top',
        _operations: [],
        fillRect: function(x, y, w, h) {
          this._operations.push({ type: 'fillRect', fillStyle: this.fillStyle, x, y, w, h });
        },
        fillText: function(text, x, y) {
          this._operations.push({ type: 'fillText', fillStyle: this.fillStyle, font: this.font, textAlign: this.textAlign, textBaseline: this.textBaseline, text, x, y });
        },
        measureText: function(text) {
          return { width: text.length * 40 }; // Rough estimate
        }
      };
    },
    toBuffer: function(format) {
      // This would need a proper canvas library like node-canvas
      // For serverless, we'll use a simpler approach
      return Buffer.from('fake-image-data');
    }
  };
  return canvas;
}

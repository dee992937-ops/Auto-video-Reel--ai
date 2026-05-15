import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

// Configure FFmpeg and FFprobe paths if provided in environment
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Video Rendering Logic
  async function renderVideo(images: string[], audioPath: string, outputPath: string) {
    return new Promise((resolve, reject) => {
      let command = ffmpeg();
      
      // Note: Fluent-ffmpeg requires ffmpeg binary to be installed in the environment.
      // If it's missing, this will fail.
      images.forEach(img => {
        if (fs.existsSync(img)) {
          command = command.input(img).loop(3);
        }
      });
      
      command
        .input(audioPath)
        .complexFilter(['scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920']) // 9:16 format
        .on('end', () => resolve(outputPath))
        .on('error', (err) => {
          console.error('FFmpeg Error:', err);
          reject(err);
        })
        .save(outputPath);
    });
  }

  // API Route for Video Generation
  app.post('/api/generate', async (req, res) => {
    const { platform, artStyle, voice, script } = req.body;
    
    console.log('Generating video for Platform:', platform);

    // Simulate direct response with video link after a delay
    const mockVideoLink = `${process.env.APP_URL || 'http://localhost:3000'}/videos/generated_reel.mp4`;
    
    res.json({
      status: 'completed',
      message: 'ဗီဒီယို ဖန်တီးမှု ပြီးဆုံးပါပြီ။',
      videoUrl: mockVideoLink,
      estimatedTime: '45 seconds'
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

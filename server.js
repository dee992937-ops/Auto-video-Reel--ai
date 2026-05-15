import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static files from dist
app.use(express.static(path.join(__dirname, 'dist')));

// Video Generation API
app.post('/api/generate', async (req, res) => {
  try {
    const { platform, artStyle, script, theme } = req.body;

    console.log(`🎬 Generating video for: ${theme || 'Untitled'}`);

    // Mock Video for now (နောက်ပိုင်း တကယ့် FFmpeg နဲ့ လုပ်နိုင်အောင် ပြင်ပေးမယ်)
    const videoUrl = `${process.env.APP_URL || `https://${req.get('host')}`}/generated-reel.mp4`;

    res.json({
      status: 'completed',
      message: 'ဗီဒီယို အောင်မြင်စွာ ဖန်တီးပြီးပါပြီ။',
      videoUrl: videoUrl,
      estimatedTime: '45 seconds'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ status: 'error', message: 'ဗီဒီယို ဖန်တီးရန် မအောင်မြင်ပါ။' });
  }
});

// Handle all other routes → React App
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MediaForge AI is running on http://0.0.0.0:${PORT}`);
});

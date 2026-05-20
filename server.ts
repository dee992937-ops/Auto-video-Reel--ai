import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';
import { spawn } from 'child_process';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

// Configure FFmpeg and FFprobe paths if provided in environment
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}
if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

const aiClient = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const VIDEO_OUTPUT_DIR = path.join(__dirname, 'videos');
const IMAGE_OUTPUT_DIR = path.join(__dirname, 'image-assets');
const TEMP_DIR = path.join(__dirname, 'temp');
const LOCAL_MUSIC_DIR = path.join(__dirname, 'music');

fs.mkdirSync(VIDEO_OUTPUT_DIR, { recursive: true });
fs.mkdirSync(IMAGE_OUTPUT_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });
fs.mkdirSync(LOCAL_MUSIC_DIR, { recursive: true });

const ART_STYLE_PROMPTS: Record<string, string> = {
  AUTOREELS: 'in AUTOREELS style, high quality',
  COMIC_BOOK: 'in COMIC BOOK style, high quality',
  DISNEY_TOON: 'in DISNEY TOON style, high quality',
  STEAMPUNK: 'in STEAMPUNK style, high quality',
  SURREALISM: 'in SURREALISM style, high quality',
  VINTAGE_CARTOON: 'in VINTAGE CARTOON style, high quality',
  NEON_VAPORWAVE: 'in NEON VAPORWAVE style, high quality',
  PENCIL_SKETCH: 'in PENCIL SKETCH style, high quality',
  RETRO_80S_90S: 'in RETRO 80s/90s style, high quality',
  GRUNGE: 'in GRUNGE style, high quality',
  ILLUSTRATIVE_REALISM: 'in ILLUSTRATIVE REALISM style, high quality',
  IMPRESSIONISM: 'in IMPRESSIONISM style, high quality',
  FANTASY_ANIME: 'in FANTASY ANIME style, high quality',
  FANTASY_REALISM: 'in FANTASY REALISM style, high quality',
  FLAT_ART: 'in FLAT ART style, high quality',
  PIXAR: 'in PIXAR style, high quality',
  ART_DECO: 'in ART DECO style, high quality',
  BLACK_WHITE_NOIR: 'in BLACK & WHITE NOIR style, high quality',
  CYBERPUNK: 'in CYBERPUNK style, high quality',
  CHARCOAL: 'in CHARCOAL style, high quality',
  GTA_V: 'in GTA V style, high quality',
  ANIME: 'in ANIME style, high quality'
};

const DEFAULT_MUSIC_LIBRARY = [
  { name: 'Alpha Prime', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', mood: 'WILD' },
  { name: 'Neon Jungle', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', mood: 'Cinematic' },
  { name: 'Power Surge', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', mood: 'Upbeat' },
  { name: 'Ocean Breeze', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3', mood: 'Calm' },
  { name: 'Midnight City', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3', mood: 'Synth' }
];

function normalizeStyle(style: string) {
  return (style || 'AUTOREELS').trim().replace(/\s+/g, '_').toUpperCase();
}

function getStylePrompt(style: string) {
  const normalized = normalizeStyle(style);
  return ART_STYLE_PROMPTS[normalized] || `in ${normalized.replace(/_/g, ' ')} style, high quality`;
}

function getAssColor(hex: string) {
  const cleaned = (hex || '#FFFFFF').replace('#', '');
  const r = cleaned.slice(0, 2);
  const g = cleaned.slice(2, 4);
  const b = cleaned.slice(4, 6);
  return `&H00${b}${g}${r}`;
}

function secondsToAssTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds % 1) * 100);
  return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`;
}

async function extractJsonFromText(raw: string) {
  const first = raw.indexOf('{');
  const last = raw.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch (error) {
      // fallback to safer parser
    }
  }
  return null;
}

async function getResponseText(response: any) {
  if (!response) return '';
  if (typeof response.text === 'function') {
    return String(await response.text());
  }
  if (Array.isArray(response.output) && response.output[0]?.content?.[0]?.text) {
    return String(response.output[0].content[0].text);
  }
  return String(response || '');
}

async function synthesizeVoice(text: string, outputPath: string) {
  if (!process.env.EDGE_TTS_ENABLED && !process.env.EDGE_TTS_PATH) {
    return null;
  }
  const edgeCommand = process.env.EDGE_TTS_PATH || 'edge-tts';
  return new Promise<string | null>((resolve, reject) => {
    const child = spawn(edgeCommand, ['--voice', 'en-US-AriaNeural', '--text', text, '--write-media', outputPath], {
      stdio: 'inherit'
    });
    child.on('exit', (code) => {
      if (code === 0) {
        resolve(outputPath);
      } else {
        resolve(null);
      }
    });
    child.on('error', () => resolve(null));
  });
}

async function chooseMusicTrack(keyword: string) {
  const localFiles = fs.readdirSync(LOCAL_MUSIC_DIR).filter(file => file.endsWith('.mp3') || file.endsWith('.wav'));
  if (localFiles.length > 0) {
    return path.join(LOCAL_MUSIC_DIR, localFiles[0]);
  }

  if (process.env.PIXABAY_API_KEY) {
    try {
      const search = encodeURIComponent(`${keyword || 'cinematic'} background music`);
      const response = await fetch(`https://pixabay.com/api/?key=${process.env.PIXABAY_API_KEY}&q=${search}&category=music&per_page=3`);
      const data = await response.json();
      const url = data.hits?.[0]?.audio?.mp3 || data.hits?.[0]?.url;
      if (url) return url;
    } catch (error) {
      console.warn('Pixabay music lookup failed, falling back to built-in library.');
    }
  }

  const match = DEFAULT_MUSIC_LIBRARY.find(track => track.mood.toLowerCase().includes((keyword || '').toLowerCase()));
  return match?.url || DEFAULT_MUSIC_LIBRARY[0].url;
}

async function downloadImagesForPrompts(prompts: Array<{ page: number; prompt: string }>) {
  const downloaded = [];
  for (const item of prompts) {
    const filename = `slide-${item.page}-${Date.now()}.jpg`;
    const destPath = path.join(IMAGE_OUTPUT_DIR, filename);
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(item.prompt)}`;
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Image service returned ${response.status}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.promises.writeFile(destPath, buffer);
      downloaded.push(destPath);
    } catch (error) {
      console.warn('Image download failed, using fallback placeholder:', error);
      const placeholderUrl = `https://picsum.photos/1080/1920?random=${item.page}`;
      const fallbackResp = await fetch(placeholderUrl);
      const fallbackBuffer = Buffer.from(await fallbackResp.arrayBuffer());
      await fs.promises.writeFile(destPath, fallbackBuffer);
      downloaded.push(destPath);
    }
  }
  return downloaded;
}

async function createASS(subtitles: Array<{ text: string; start: number; end: number }>, outputPath: string, config: any) {
  const font = config.font || 'Arial';
  const size = config.size || 50;
  const color = getAssColor(config.color || '#FFFFFF');
  const shadowColor = getAssColor(config.shadowColor || '#000000');
  const alignment = config.position === 'Center' ? 2 : 8;
  const styleLine = `Style:Default,${font},${size},${color},${color},${shadowColor},0,0,0,0,100,100,0,0,1,${alignment},0,0,0,0,0,0,0`;

  const lines = subtitles.map((subtitle, index) => {
    const startTime = secondsToAssTime(subtitle.start);
    const endTime = secondsToAssTime(subtitle.end);
    const safeText = subtitle.text.replace(/\n/g, '\\N').replace(/,/g, '\\,');
    return `Dialogue: 0,${startTime},${endTime},Default,,0,0,0,,${safeText}`;
  });

  const content = [
    '[Script Info]',
    'ScriptType: v4.00+',
    'PlayResX: 1080',
    'PlayResY: 1920',
    '',
    '[V4+ Styles]',
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding',
    styleLine,
    '',
    '[Events]',
    'Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text',
    ...lines
  ].join('\n');

  await fs.promises.writeFile(outputPath, content, 'utf-8');
  return outputPath;
}

async function createSlideSegment(imagePath: string, duration: number, segmentPath: string) {
  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(imagePath)
      .inputOptions(['-loop 1'])
      .duration(duration)
      .outputOptions(['-r 30', '-pix_fmt yuv420p', '-c:v libx264', '-movflags +faststart'])
      .videoFilters([
        'scale=1080:1920:force_original_aspect_ratio=decrease',
        'pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black',
        `zoompan=z='min(zoom+0.0007,1.1)':d=${Math.ceil(duration * 30)}:s=1080x1920`,
        'fade=t=in:st=0:d=0.5',
        `fade=t=out:st=${Math.max(duration - 0.5, 0)}:d=0.5`
      ])
      .save(segmentPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function concatVideoSegments(segmentPaths: string[], outputPath: string) {
  const listFile = path.join(TEMP_DIR, `concat-${Date.now()}.txt`);
  const content = segmentPaths.map(file => `file '${file.replace(/'/g, "'\\''")}'`).join('\n');
  await fs.promises.writeFile(listFile, content, 'utf-8');

  return new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(listFile)
      .inputOptions(['-f concat', '-safe 0'])
      .outputOptions(['-c copy'])
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (err) => reject(err));
  });
}

async function renderVideo(imagePaths: string[], musicPath: string, voicePath: string | null, subtitlePath: string | null, outputPath: string) {
  const segmentPaths: string[] = [];
  const sceneDuration = Math.max(5, Math.floor(60 / Math.max(imagePaths.length, 1)));

  for (let index = 0; index < imagePaths.length; index += 1) {
    const segmentPath = path.join(TEMP_DIR, `segment-${index}-${Date.now()}.mp4`);
    await createSlideSegment(imagePaths[index], sceneDuration, segmentPath);
    segmentPaths.push(segmentPath);
  }

  const concatPath = path.join(TEMP_DIR, `slideshow-${Date.now()}.mp4`);
  await concatVideoSegments(segmentPaths, concatPath);

  return new Promise<string>((resolve, reject) => {
    const command = ffmpeg();
    command.input(concatPath);
    command.input(musicPath);

    if (voicePath) {
      command.input(voicePath);
      command.complexFilter(['[1:a][2:a]amix=inputs=2:duration=shortest:dropout_transition=2[aout]']);
      command.outputOptions(['-map 0:v', '-map [aout]']);
    } else {
      command.outputOptions(['-map 0:v', '-map 1:a']);
    }

    if (subtitlePath) {
      command.videoFilters(`ass=${subtitlePath}`);
    }

    command
      .outputOptions(['-c:v libx264', '-c:a aac', '-shortest', '-pix_fmt yuv420p', '-movflags +faststart'])
      .save(outputPath)
      .on('end', () => resolve(outputPath))
      .on('error', (err) => reject(err));
  });
}

async function generateStructuredPipeline(script: string, artStyle: string, duration: number, destination: string) {
  const stylePrompt = getStylePrompt(artStyle);
  const prompt = `You are a deterministic video production engine. Given the screenplay below, output valid JSON only with keys:\n` +
    `"subtitles" (array of {text, start, end}),\n"imagePrompts" (array of {page, prompt}),\n"musicMood" (single keyword),\n"voiceText" (one combined voiceover text).\n` +
    `Use exactly the selected art direction phrase: \"${stylePrompt}\" in every image prompt.\n` +
    `Create a 30 to 60 second structure with timestamps and scene captions for a high-performing social video. No markdown, no commentary, only JSON.\n\nScript:\n${script}`;

  const model = aiClient?.getGenerativeModel({ model: 'gemini-1.5-flash' });
  if (!model) {
    return {
      subtitles: [
        { text: script.slice(0, 80), start: 0, end: 6 },
        { text: script.slice(80, 160), start: 6, end: 14 },
        { text: script.slice(160, 240), start: 14, end: 24 }
      ],
      imagePrompts: [
        { page: 1, prompt: `${stylePrompt} ${script.slice(0, 80)}` }
      ],
      musicMood: 'Cinematic',
      voiceText: script
    };
  }

  const result = await model.generateContent(prompt);
  const text = await getResponseText(result.response);
  const parsed = await extractJsonFromText(text);
  if (parsed && parsed.subtitles && parsed.imagePrompts) {
    return parsed;
  }

  return {
    subtitles: [
      { text: script.slice(0, 80), start: 0, end: 6 },
      { text: script.slice(80, 160), start: 6, end: 14 },
      { text: script.slice(160, 240), start: 14, end: 24 }
    ],
    imagePrompts: [
      { page: 1, prompt: `${stylePrompt} ${script.slice(0, 80)}` }
    ],
    musicMood: 'Cinematic',
    voiceText: script
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use('/videos', express.static(VIDEO_OUTPUT_DIR));
  app.use('/image-assets', express.static(IMAGE_OUTPUT_DIR));

  app.post('/api/generate', async (req, res) => {
    try {
      const { theme, destination, duration = 30, artStyle = 'AUTOREELS', script = '', subtitleConfig = {}, musicKeyword = '' } = req.body;
      let finalScript = script;

      if (!finalScript && aiClient) {
        const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const scriptPrompt = `Create a viral ${destination} script for a ${duration}s video about: ${theme}. Use the art direction phrase: ${getStylePrompt(artStyle)}. Provide a concise scene structure with subtitles and visual cues.`;
        const scriptResult = await model.generateContent(scriptPrompt);
        finalScript = await getResponseText(scriptResult.response);
      }

      if (!finalScript) {
        finalScript = `A short ${duration}s social video on ${theme} with clear visual text and strong hooks.`;
      }

      const pipeline = await generateStructuredPipeline(finalScript, artStyle, duration, destination);
      const musicPath = await chooseMusicTrack(musicKeyword || pipeline.musicMood || 'Cinematic');
      const imageFiles = await downloadImagesForPrompts(pipeline.imagePrompts || [{ page: 1, prompt: `${getStylePrompt(artStyle)} ${theme}` }]);
      const subtitlePath = path.join(TEMP_DIR, `subtitles-${Date.now()}.ass`);
      await createASS(pipeline.subtitles || [{ text: finalScript, start: 0, end: duration }], subtitlePath, subtitleConfig);
      const voicePath = await synthesizeVoice(pipeline.voiceText || finalScript, path.join(TEMP_DIR, `voice-${Date.now()}.mp3`));
      const outputFile = path.join(VIDEO_OUTPUT_DIR, `generated_reel_${Date.now()}.mp4`);
      await renderVideo(imageFiles, musicPath, voicePath, subtitlePath, outputFile);

      const videoUrl = `${process.env.APP_URL || 'http://localhost:3000'}/videos/${path.basename(outputFile)}`;
      res.json({
        status: 'completed',
        message: 'Production pipeline finished successfully.',
        videoUrl,
        pipeline: { ...pipeline, musicPath, imageFiles }
      });
    } catch (error) {
      console.error('Video generation failed:', error);
      res.status(500).json({ status: 'failed', message: 'Video pipeline failed', error: String(error) });
    }
  });

  app.post('/api/script', async (req, res) => {
    try {
      const { theme, destination, duration, artStyle } = req.body;
      if (!aiClient) {
        return res.json({ script: 'Default scripting template active.' });
      }
      const model = aiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const prompt = `Create a viral ${destination} script for a ${duration}s video about: ${theme}. Visual direction: The video should follow a high-quality "${getStylePrompt(artStyle)}" art style aesthetic. Provide a logical structure with scenes, captions, and visual cues. Return plain text only.`;
      const result = await model.generateContent(prompt);
      const script = await getResponseText(result.response);
      res.json({ script });
    } catch (error) {
      console.error('AI script generation failed:', error);
      res.status(500).json({ script: 'Default scripting template active.' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
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

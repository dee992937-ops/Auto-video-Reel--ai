import asyncio
import json
import os
import shutil
import urllib.parse
from pathlib import Path
from typing import Any, Dict, List, Optional

import edge_tts
import google.generativeai as genai
import httpx
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

APP_ROOT = Path("/app")
OUTPUT_DIR = APP_ROOT / "output"
TEMP_DIR = APP_ROOT / "temp"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
TEMP_DIR.mkdir(parents=True, exist_ok=True)

GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)

FREE_BGM_URLS = [
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
    "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
]

ART_STYLE_OPTIONS = [
    "GTA V",
    "Anime",
    "Cyberpunk",
    "Pixar",
    "Disney Toon",
    "Steampunk",
    "Surrealism",
    "Vintage Cartoon",
    "Neon Vaporwave",
    "Pencil Sketch",
    "Retro 80s/90s",
    "Grunge",
    "Illustrative Realism",
    "Impressionism",
    "Fantasy Anime",
    "Fantasy Realism",
    "Flat Art",
    "Art Deco",
    "Black & White Noir",
    "Charcoal",
]

VOICE_MAP = {
    "en": "en-US-AriaNeural",
    "my": "en-US-AriaNeural",
}

app = FastAPI(title="Tech Snap AI Video Generator")
app.mount("/output", StaticFiles(directory=OUTPUT_DIR), name="output")


class GenerateRequest(BaseModel):
    theme: str
    art_style: str = "GTA V"
    language: str = "en"
    duration_seconds: int = 30
    voice_language: str = "en"
    background_mood: Optional[str] = None


def sanitize_art_style(style: str) -> str:
    if not style:
        return "GTA V"
    style = style.strip()
    return style if style in ART_STYLE_OPTIONS else style


def normalize_text(text: str) -> str:
    return " ".join(text.replace("\n", " ").split())


def extract_json_from_text(raw_text: str) -> Optional[Dict[str, Any]]:
    try:
        start = raw_text.index("{")
        end = raw_text.rindex("}")
    except ValueError:
        return None
    candidate = raw_text[start:end + 1]
    try:
        return json.loads(candidate)
    except json.JSONDecodeError:
        return None


@app.get("/", response_class=HTMLResponse)
async def home() -> HTMLResponse:
    return HTMLResponse(
        """
        <html>
            <head>
                <title>Tech Snap AI Video Generator</title>
            </head>
            <body style="font-family:Arial, sans-serif; background:#0d1117; color:#f8f8f2; margin:0; padding:2rem;">
                <h1>Tech Snap AI Video Generator</h1>
                <p>POST to <code>/generate</code> with JSON payload to create a viral short video.</p>
                <pre style="background:#161b22; padding:1rem; border-radius:0.75rem; overflow-x:auto;">{
  "theme": "Motivational travel hook",
  "art_style": "Cyberpunk",
  "language": "en",
  "duration_seconds": 30
}</pre>
                <p>Download finished video from <code>/output/final_viral_shorts.mp4</code>.</p>
            </body>
        </html>
        """
    )


async def generate_with_gemini(prompt: str) -> str:
    if not GEMINI_API_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured")
    response = genai.generate_text(
        model="gemini-1.5-flash",
        prompt=prompt,
        temperature=0.2,
        max_output_tokens=400,
    )
    return getattr(response, "text", str(response))


async def create_script_and_prompts(theme: str, art_style: str, duration_seconds: int) -> Dict[str, Any]:
    art_style = sanitize_art_style(art_style)
    prompt = (
        f"Generate a viral {duration_seconds}-second TikTok/YouTube Shorts script about {theme}. "
        f"Use the art style phrase '{art_style}' in every generated image prompt. "
        "Return only valid JSON with keys: subtitles, image_prompts, music_mood, voice_text. "
        "subtitles must be an array of objects with text, start, end seconds. "
        "image_prompts must be an array of objects with index and prompt. "
    )

    fallback = {
        "subtitles": [
            {"text": f"{theme} is unstoppable.", "start": 0, "end": 7},
            {"text": "This moment changes everything.", "start": 7, "end": 15},
            {"text": "See how it unlocks viral energy.", "start": 15, "end": 23},
            {"text": "Share now and feel the rush.", "start": 23, "end": duration_seconds},
        ],
        "image_prompts": [
            {"index": 1, "prompt": f"{art_style} energetic city scene, fast-paced storytelling"},
            {"index": 2, "prompt": f"{art_style} dramatic close-up with bold text and cinematic lighting"},
            {"index": 3, "prompt": f"{art_style} lifestyle action shot with motion blur and neon accents"},
            {"index": 4, "prompt": f"{art_style} final hook scene with bright caption and crisp composition"},
        ],
        "music_mood": "Cinematic",
        "voice_text": f"{theme}. This is your viral short, built to hook viewers fast.",
    }

    try:
        if GEMINI_API_KEY:
            raw = await generate_with_gemini(prompt)
            extracted = extract_json_from_text(raw)
            if extracted:
                extracted["voice_text"] = normalize_text(extracted.get("voice_text", fallback["voice_text"]))
                return {
                    "subtitles": extracted.get("subtitles", fallback["subtitles"]),
                    "image_prompts": extracted.get("image_prompts", fallback["image_prompts"]),
                    "music_mood": extracted.get("music_mood", fallback["music_mood"]),
                    "voice_text": extracted.get("voice_text", fallback["voice_text"]),
                }
    except Exception:
        pass

    return fallback


async def download_file(url: str, destination: Path) -> Path:
    async with httpx.AsyncClient(timeout=30.0, follow_redirects=True) as client:
        response = await client.get(url)
        response.raise_for_status()
        destination.write_bytes(response.content)
    return destination


async def download_pollinations_images(image_prompts: List[Dict[str, Any]]) -> List[Path]:
    images: List[Path] = []
    async with httpx.AsyncClient(timeout=60.0, follow_redirects=True) as client:
        for prompt in image_prompts:
            prompt_text = prompt.get("prompt") if isinstance(prompt, dict) else str(prompt)
            safe_prompt = urllib.parse.quote(prompt_text)
            image_url = f"https://image.pollinations.ai/p/{safe_prompt}"
            target = TEMP_DIR / f"image_{len(images) + 1}.jpg"
            try:
                resp = await client.get(image_url)
                resp.raise_for_status()
                target.write_bytes(resp.content)
                images.append(target)
            except Exception:
                fallback_url = f"https://picsum.photos/1080/1920?random={len(images) + 1}"
                resp = await client.get(fallback_url)
                resp.raise_for_status()
                target.write_bytes(resp.content)
                images.append(target)
    return images


async def choose_background_music(keyword: Optional[str]) -> Path:
    candidate_url = FREE_BGM_URLS[0]
    if keyword:
        if "cinematic" in keyword.lower():
            candidate_url = FREE_BGM_URLS[0]
        elif "upbeat" in keyword.lower():
            candidate_url = FREE_BGM_URLS[1]
        elif "dramatic" in keyword.lower():
            candidate_url = FREE_BGM_URLS[2]
    target = TEMP_DIR / "bgm.mp3"
    return await download_file(candidate_url, target)


async def synthesize_voice(text: str, voice_language: str) -> Path:
    voice = VOICE_MAP.get(voice_language.lower(), VOICE_MAP["en"])
    output_path = TEMP_DIR / "voice.mp3"
    communicate = edge_tts.Communicate(text, voice)
    await communicate.save(str(output_path))
    return output_path


def seconds_to_ass(ts: float) -> str:
    total = int(ts * 100)
    frames = total % 100
    seconds = (total // 100) % 60
    minutes = (total // 6000) % 60
    hours = total // 360000
    return f"{hours}:{minutes:02d}:{seconds:02d}.{frames:02d}"


def build_ass_file(subtitles: List[Dict[str, Any]], path: Path) -> Path:
    lines = [
        "[Script Info]",
        "ScriptType: v4.00+",
        "PlayResX: 1080",
        "PlayResY: 1920",
        "\n[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
        "Style: Default,Arial,72,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,1,0,0,0,100,100,0,0,1,4,0,0,50,10,10,0",
        "\n[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
    ]
    for item in subtitles:
        text = normalize_text(str(item.get("text", ""))).replace(",", "\\,").replace("\n", "\\N")
        start = float(item.get("start", 0))
        end = float(item.get("end", start + 5))
        lines.append(
            f"Dialogue: 0,{seconds_to_ass(start)},{seconds_to_ass(end)},Default,,0,0,0,,{text}"
        )
    path.write_text("\n".join(lines), encoding="utf-8")
    return path


async def create_video_segments(image_files: List[Path], duration: int) -> Path:
    segment_files: List[Path] = []
    for index, image_file in enumerate(image_files):
        segment_path = TEMP_DIR / f"segment_{index}.mp4"
        command = [
            "ffmpeg",
            "-y",
            "-loop",
            "1",
            "-i",
            str(image_file),
            "-vf",
            "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:black,zoompan=z='min(1.2,zoom+0.0007)':d={}:s=1080x1920,format=yuv420p".format(duration * 30),
            "-t",
            str(duration),
            "-r",
            "30",
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            str(segment_path),
        ]
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg segment creation failed: {stderr.decode(errors='ignore')}")
        segment_files.append(segment_path)

    list_file = TEMP_DIR / "segments.txt"
    list_file.write_text("\n".join([f"file '{str(p)}'" for p in segment_files]), encoding="utf-8")
    concat_path = TEMP_DIR / "concat.mp4"
    command = [
        "ffmpeg",
        "-y",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        str(list_file),
        "-c",
        "copy",
        str(concat_path),
    ]
    process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await process.communicate()
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg concat failed: {stderr.decode(errors='ignore')}")
    return concat_path


async def mix_audio(voice_path: Optional[Path], bgm_path: Optional[Path]) -> Optional[Path]:
    if voice_path and bgm_path:
        mixed_path = TEMP_DIR / "mix.mp3"
        command = [
            "ffmpeg",
            "-y",
            "-i",
            str(bgm_path),
            "-i",
            str(voice_path),
            "-filter_complex",
            "[0:a]volume=0.25[a0];[1:a]volume=1.0[a1];[a0][a1]amix=inputs=2:duration=shortest:dropout_transition=2[aout]",
            "-map",
            "[aout]",
            "-c:a",
            "aac",
            "-b:a",
            "192k",
            str(mixed_path),
        ]
        process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        _, stderr = await process.communicate()
        if process.returncode != 0:
            raise RuntimeError(f"FFmpeg audio mix failed: {stderr.decode(errors='ignore')}")
        return mixed_path
    if voice_path:
        return voice_path
    if bgm_path:
        return bgm_path
    return None


async def render_final_video(concat_video: Path, audio_path: Optional[Path], ass_path: Path, output_path: Path) -> Path:
    filter_str = (
        f"ass={ass_path},"
        "drawtext=fontfile=/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf:"
        "text='Made with Tech Snap AI':fontcolor=white@0.9:fontsize=34:"
        "x=(w-text_w)/2:y=h-80:box=1:boxcolor=black@0.6:boxborderw=15"
    )

    command = ["ffmpeg", "-y", "-i", str(concat_video)]
    if audio_path:
        command += ["-i", str(audio_path)]
    command += ["-vf", filter_str]
    if audio_path:
        command += ["-map", "0:v", "-map", "1:a"]
    command += [
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        "-b:a",
        "192k",
        "-shortest",
        str(output_path),
    ]
    process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    _, stderr = await process.communicate()
    if process.returncode != 0:
        raise RuntimeError(f"FFmpeg final render failed: {stderr.decode(errors='ignore')}")
    return output_path


def cleanup_temp() -> None:
    for item in TEMP_DIR.iterdir():
        try:
            if item.is_dir():
                shutil.rmtree(item)
            else:
                item.unlink()
        except Exception:
            pass


@app.post("/generate")
async def generate_video(request: Request, payload: GenerateRequest) -> JSONResponse:
    if not payload.theme:
        raise HTTPException(status_code=400, detail="theme is required")

    cleanup_temp()
    payload.art_style = sanitize_art_style(payload.art_style)
    pipeline = await create_script_and_prompts(payload.theme, payload.art_style, payload.duration_seconds)
    images = await download_pollinations_images(pipeline["image_prompts"])
    voice_path = await synthesize_voice(pipeline["voice_text"], payload.voice_language)
    bgm_path = await choose_background_music(payload.background_mood or pipeline.get("music_mood"))
    concat_video = await create_video_segments(images, max(6, payload.duration_seconds // max(len(images), 1)))
    ass_file = build_ass_file(pipeline["subtitles"], TEMP_DIR / "captions.ass")
    mixed_audio = await mix_audio(voice_path, bgm_path)
    final_output = OUTPUT_DIR / "final_viral_shorts.mp4"

    if final_output.exists():
        final_output.unlink()

    await render_final_video(concat_video, mixed_audio, ass_file, final_output)

    host = request.headers.get("host", "localhost:7860")
    scheme = request.url.scheme or "https"
    video_url = f"{scheme}://{host}/output/{final_output.name}"

    return JSONResponse({
        "status": "success",
        "video_url": video_url,
        "message": "Video generated successfully.",
        "art_style": payload.art_style,
        "duration_seconds": payload.duration_seconds,
        "watermark": "Made with Tech Snap AI",
    })


@app.get("/health")
async def health() -> JSONResponse:
    return JSONResponse({"status": "ok", "output_dir": str(OUTPUT_DIR)})

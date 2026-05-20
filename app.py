
import os
import asyncio
import json
import re
import uuid
from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
import google.generativeai as genai
import httpx
import edge_tts
from fastapi.staticfiles import StaticFiles

# --- 1. Environment & Framework Setup ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
if not GEMINI_API_KEY:
    raise ValueError("GEMINI_API_KEY environment variable not set.")
genai.configure(api_key=GEMINI_API_KEY)

app = FastAPI()

# --- I/O & Storage Management ---
OUTPUT_DIR = "/app/output"
os.makedirs(OUTPUT_DIR, exist_ok=True)
app.mount("/videos", StaticFiles(directory=OUTPUT_DIR), name="videos")

class VideoRequest(BaseModel):
    topic: str
    art_style: str

# --- 2. The Whole Process Pipeline (Perfect Data Flow) ---

# --- Function 1: Secure API & Request Parsing ---
def sanitize_json_from_ai(text: str) -> str:
    """Extracts a JSON object from a string, even if it's embedded in markdown."""
    match = re.search(r'```json
({.*?})
```', text, re.DOTALL)
    if match:
        return match.group(1)
    # Fallback for non-markdown responses
    return text

async def get_ai_script_and_prompt(topic: str):
    """Generates a script and image prompt using Gemini Flash, with robust JSON parsing."""
    model = genai.GenerativeModel('gemini-1.5-flash')
    prompt = f"Create a 30-second viral shorts script about {topic}. Also, create a detailed image generation prompt for this script. Return a single, valid JSON object with two keys: 'script' and 'image_prompt'. Example: {{ \"script\": \"This is a viral script.\", \"image_prompt\": \"A futuristic cityscape at dusk, neon lights, flying cars.\"}}"
    try:
        response = await model.generate_content_async(prompt)
        sanitized_text = sanitize_json_from_ai(response.text)
        return json.loads(sanitized_text)
    except (json.JSONDecodeError, IndexError, Exception) as e:
        raise HTTPException(status_code=500, detail=f"Error parsing response from AI model: {e}")

# --- Function 2: Non-Blocking Voice Generator ---
async def generate_voiceover(script: str, output_path: str):
    """Generates audio from text using edge-tts asynchronously."""
    communicate = edge_tts.Communicate(script, "en-US-JennyNeural")
    await communicate.save(output_path)

# --- Function 3: Async Image Downloader ---
async def download_background_image(prompt: str, art_style: str, output_path: str):
    """Downloads an image asynchronously from a free API."""
    full_prompt = f"{prompt}, {art_style} style"
    url = f"https://image.pollinations.ai/p/{httpx.URL(full_prompt).path}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.get(url)
        response.raise_for_status()
        with open(output_path, "wb") as f:
            f.write(response.content)

# --- Function 4: High-Performance FFmpeg Render Engine ---
def wrap_text(text: str, line_length: int) -> list[str]:
    """Wraps text to a specified line length for subtitles."""
    words = text.replace("\n", " ").split()
    lines = []
    current_line = ""
    for word in words:
        if len(current_line) + len(word) + 1 <= line_length:
            current_line += f" {word}"
        else:
            lines.append(current_line.strip())
            current_line = word
    lines.append(current_line.strip())
    return [line for line in lines if line]

async def render_video(image_path: str, audio_path: str, script: str, output_path: str):
    """Renders the video using FFmpeg with performance optimizations and dynamic subtitles."""
    # Word wrapping for dynamic MrBeast-style captions
    wrapped_lines = wrap_text(script, 35)
    line_height = 60
    total_text_height = len(wrapped_lines) * line_height
    start_y = f"(h-{total_text_height})/2"
    
    drawtext_filters = []
    for i, line in enumerate(wrapped_lines):
        escaped_line = line.replace("'", "'\\''")
        drawtext_filters.append(
            f"drawtext=text='{escaped_line}':fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf:fontsize=42:fontcolor=white:x=(w-text_w)/2:y={start_y}+{i*line_height}:box=1:boxcolor=black@0.6:boxborderw=10"
        )
    
    # Smooth Ken Burns zoom effect and watermark
    filter_complex = [
        f"[0:v]zoompan=z='min(zoom+0.001,1.3)':d=900:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)',scale=1080:1920,setsar=1[v];",
        f"[v]{','.join(drawtext_filters)},drawtext=text='Made with Tech Snap AI':fontsize=20:fontcolor=white@0.8:x=w-tw-10:y=h-th-10[v_out]"
    ]

    command = [
        "ffmpeg",
        "-loop", "1", "-i", image_path,
        "-i", audio_path,
        "-filter_complex", "".join(filter_complex),
        "-map", "[v_out]",
        "-map", "1:a",
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "22",
        "-c:a", "aac", "-b:a", "128k",
        "-threads", "4",  # CPU Limiter for Hugging Face
        "-t", "30",
        "-pix_fmt", "yuv420p",
        "-y", output_path
    ]
    
    process = await asyncio.create_subprocess_exec(*command, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
    stdout, stderr = await process.communicate()
    
    if process.returncode != 0:
        raise HTTPException(status_code=500, detail=f"Video rendering failed: {stderr.decode()}")

# --- 3. Instant Download Response & Auto-Cleanup ---
def cleanup_temp_files(files: list):
    """Deletes temporary files in the background."""
    for f in files:
        try:
            os.remove(f)
        except OSError:
            pass

@app.post("/generate_video")
async def generate_video_endpoint(request: VideoRequest, background_tasks: BackgroundTasks):
    """Main API endpoint to generate a video from a topic and art style."""
    request_id = str(uuid.uuid4())
    temp_audio_path = os.path.join(OUTPUT_DIR, f"{request_id}.mp3")
    temp_image_path = os.path.join(OUTPUT_DIR, f"{request_id}.jpg")
    final_video_path = os.path.join(OUTPUT_DIR, f"{request_id}.mp4")

    try:
        # Step 1: Get Script & Prompt
        ai_content = await get_ai_script_and_prompt(request.topic)
        script = ai_content.get("script", "Default script.")
        image_prompt = ai_content.get("image_prompt", "A beautiful landscape.")

        # Step 2 & 3: Generate Voice and Image concurrently
        await asyncio.gather(
            generate_voiceover(script, temp_audio_path),
            download_background_image(image_prompt, request.art_style, temp_image_path)
        )

        # Step 4: Render Video
        await render_video(temp_image_path, temp_audio_path, script, final_video_path)

    except HTTPException as e:
        return JSONResponse(status_code=e.status_code, content={"detail": e.detail})
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})
    finally:
        # Auto-cleanup temporary files
        background_tasks.add_task(cleanup_temp_files, [temp_audio_path, temp_image_path])

    return {"video_url": f"/videos/{request_id}.mp4"}


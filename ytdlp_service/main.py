import os
import re
import secrets
import tempfile
from pathlib import Path
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse
from pydantic import BaseModel, HttpUrl
import yt_dlp

app = FastAPI(title="YuiAPI yt-dlp service")

TOKEN = os.environ.get("YTDLP_SHARED_SECRET", "")
MAX_FILE_BYTES = int(os.environ.get("YTDLP_MAX_FILE_BYTES", str(800 * 1024 * 1024)))

class DownloadRequest(BaseModel):
    url: HttpUrl
    quality: int = 720

@app.get("/health")
def health():
    return {"ok": True, "engine": "yt-dlp"}

@app.post("/download")
def download(body: DownloadRequest, x_ytdlp_token: str | None = Header(default=None)):
    if not TOKEN or not x_ytdlp_token or not secrets.compare_digest(TOKEN, x_ytdlp_token):
        raise HTTPException(status_code=401, detail="Unauthorized")
    if body.quality not in (360, 480, 720, 1080):
        raise HTTPException(status_code=400, detail="quality must be 360, 480, 720 or 1080")
    url = str(body.url)
    if not re.match(r"^https?://(www\\.)?(youtube\\.com|youtu\\.be)/", url):
        raise HTTPException(status_code=400, detail="Only YouTube URLs are supported")

    temp_dir = tempfile.mkdtemp(prefix="yui-yt-")
    output = str(Path(temp_dir) / "%(id)s.%(ext)s")
    opts = {
        "format": f"bv*[height<={body.quality}]+ba/b[height<={body.quality}]/b",
        "merge_output_format": "mp4",
        "outtmpl": output,
        "noplaylist": True,
        "quiet": True,
        "no_warnings": True,
        "retries": 3,
        "fragment_retries": 3,
        "socket_timeout": 30,
        "max_filesize": MAX_FILE_BYTES,
    }
    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            filename = Path(ydl.prepare_filename(info))
            if filename.suffix.lower() != ".mp4":
                merged = filename.with_suffix(".mp4")
                if merged.exists():
                    filename = merged
            if not filename.exists():
                candidates = list(Path(temp_dir).glob("*.mp4"))
                if not candidates:
                    raise RuntimeError("yt-dlp completed without an MP4 file")
                filename = candidates[0]
            size = filename.stat().st_size
            if size <= 0 or size > MAX_FILE_BYTES:
                raise RuntimeError("Downloaded file is empty or exceeds configured limit")
            safe_id = re.sub(r"[^A-Za-z0-9_-]", "", str(info.get("id", "video")))[:32]
            return FileResponse(
                str(filename),
                media_type="video/mp4",
                filename=f"youtube-{safe_id}.mp4",
                background=None,
            )
    except Exception as exc:
        import shutil
        shutil.rmtree(temp_dir, ignore_errors=True)
        raise HTTPException(status_code=502, detail=f"yt-dlp: {str(exc)[:500]}") from exc

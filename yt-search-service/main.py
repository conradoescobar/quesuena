from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import subprocess
import json
import os

app = FastAPI(title="YouTube Search Service")

# CORS - permitir llamadas desde tu app de Vercel
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # En producción, pon tu dominio de Vercel
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def health_check():
    return {"status": "ok", "service": "yt-search"}

@app.get("/search")
def search_youtube(q: str):
    """
    Busca un video en YouTube usando yt-dlp

    Args:
        q: Query de búsqueda (ej: "Bad Bunny - Tití Me Preguntó")

    Returns:
        videoId, title, thumbnailUrl
    """
    if not q or len(q) < 2:
        raise HTTPException(status_code=400, detail="Query too short")

    try:
        # Ejecutar yt-dlp para buscar
        result = subprocess.run(
            [
                "yt-dlp",
                f"ytsearch1:{q}",
                "--print", "id",
                "--print", "title",
                "--no-download",
                "--no-warnings",
                "--no-playlist"
            ],
            capture_output=True,
            text=True,
            timeout=30
        )

        if result.returncode != 0:
            print(f"yt-dlp error: {result.stderr}")
            raise HTTPException(status_code=500, detail="Search failed")

        lines = result.stdout.strip().split('\n')

        if len(lines) < 2 or not lines[0]:
            raise HTTPException(status_code=404, detail="No video found")

        video_id = lines[0].strip()
        title = lines[1].strip() if len(lines) > 1 else q

        return {
            "videoId": video_id,
            "title": title,
            "thumbnailUrl": f"https://i.ytimg.com/vi/{video_id}/mqdefault.jpg"
        }

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Search timeout")
    except Exception as e:
        print(f"Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)

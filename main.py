"""
FastAPI backend for 3d-anim-ai-maker.

Run it with:
    uv run fastapi dev main.py        # dev (auto-reload)
    uv run fastapi run main.py        # prod

    POST /api/upload   accept a .gltf/.fbx/.obj model, validate it with bpy,
                       save it under public/upload/, return its public URL.
    POST /api/prompt   build the AI-animation prompt for an uploaded model.
    POST /api/run      execute AI-generated bpy code; it exports an animated
                       .glb under public/, whose URL is returned for preview.
    POST /api/chat     send a built prompt to Gemini (client-supplied key/model),
                       then run the bpy code it returns — the automatic path.
    POST /api/animation/remove
                       delete a named animation clip from an uploaded model
                       (fixed bpy Python, not AI) and overwrite it in place.
    /public/...        static files (an upload is at /public/upload/<file>).
"""

import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.config import PUBLIC_DIR, STATIC_MOUNT
from app.routers import animation, chat, files, health, prompt, run, upload

# The Vite build (frontend/) outputs the SPA here (see frontend/vite.config.ts).
INDEX_FILE = os.path.join(PUBLIC_DIR, "index.html")

app = FastAPI(title="3d-anim-ai-maker")

origins = [
    "http://localhost:5173",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve the whole public/ tree as static files, e.g. /public/upload/<file>.
app.mount(STATIC_MOUNT, StaticFiles(directory=PUBLIC_DIR), name="public")

app.include_router(health.router)
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(prompt.router)
app.include_router(run.router)
app.include_router(chat.router)
app.include_router(animation.router)


# Serve the built SPA. Registered LAST so the API routers and the /public mount
# above always take precedence. The catch-all returns a real built asset when
# one exists (e.g. /assets/app.js, /favicon.ico) and otherwise falls back to
# index.html so client-side routes like /editor work on a hard refresh.
@app.get("/")
async def serve_index() -> FileResponse:
    return FileResponse(INDEX_FILE)


@app.get("/{full_path:path}")
async def serve_spa(full_path: str) -> FileResponse:
    candidate = os.path.normpath(os.path.join(PUBLIC_DIR, full_path))

    # Guard against path traversal escaping PUBLIC_DIR before serving a file.
    if (
        full_path
        and os.path.commonpath([PUBLIC_DIR, candidate]) == PUBLIC_DIR
        and os.path.isfile(candidate)
    ):
        return FileResponse(candidate)

    return FileResponse(INDEX_FILE)

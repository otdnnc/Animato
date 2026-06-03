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
    /public/...        static files (an upload is at /public/upload/<file>).
"""

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.config import PUBLIC_DIR, STATIC_MOUNT
from app.routers import files, health, prompt, run, upload

app = FastAPI(title="3d-anim-ai-maker")

# Serve the whole public/ tree as static files, e.g. /public/upload/<file>.
app.mount(STATIC_MOUNT, StaticFiles(directory=PUBLIC_DIR), name="public")

app.include_router(health.router)
app.include_router(upload.router)
app.include_router(files.router)
app.include_router(prompt.router)
app.include_router(run.router)

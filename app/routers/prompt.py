"""Prompt endpoint: build the AI-animation prompt for an uploaded model."""

import os

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import STATIC_MOUNT, UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["prompt"])


class PromptRequest(BaseModel):
    filename: str           # name of a file already in public/upload/
    message: str = ""       # natural-language animation request to embed


@router.post("/prompt")
async def make_prompt(req: PromptRequest):
    """Build and return {prompt, output_url} for an uploaded model (no file is written)."""
    # basename() blocks path traversal: only files inside public/upload/ are reachable.
    name = os.path.basename(req.filename)
    path = os.path.join(UPLOAD_DIR, name)
    if not name or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found in upload folder: {name}")

    # Lazy import: pulls in bpy (heavy) only when a prompt is actually requested.
    from prompting import build_prompt

    # The generated script overwrites the original upload in place, so its public
    # URL is unchanged — the client previews the same /public/upload/<file> once run.
    try:
        prompt = build_prompt(path, animation=req.message, output_path=path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to build prompt: {e}")

    return {"prompt": prompt, "output_url": f"{STATIC_MOUNT}/upload/{name}"}

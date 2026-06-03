"""Upload endpoint: accept a 3D model, validate it, store it, return its URL."""

import os
import re

from fastapi import APIRouter, File, HTTPException, Request, UploadFile

from app.config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOAD_DIR
from app.responses import upload_payload
from app.validation import validate_model

router = APIRouter(prefix="/api", tags=["upload"])


def _safe_stem(filename: str) -> str:
    """Sanitise the original name to a short, filesystem-safe slug."""
    stem = os.path.splitext(os.path.basename(filename or ""))[0]
    stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("-._")
    return (stem or "model")[:60]


def _unique_filename(stem: str, ext: str) -> str:
    """Keep the original name; if it already exists, append -1, -2, ... ."""
    name = f"{stem}{ext}"
    counter = 1
    while os.path.exists(os.path.join(UPLOAD_DIR, name)):
        name = f"{stem}-{counter}{ext}"
        counter += 1
    return name


@router.post("/upload")
async def upload_model(request: Request, file: UploadFile = File(...)):
    """Accept a .gltf/.fbx/.obj model, validate it, store it, return its URL."""
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext or '?'}'. Allowed: {allowed}.",
        )

    # Keep the original (sanitised) name; append a number if it already exists.
    filename = _unique_filename(_safe_stem(file.filename), ext)
    dest = os.path.join(UPLOAD_DIR, filename)

    # Stream to disk while enforcing the size cap.
    size = 0
    try:
        with open(dest, "wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > MAX_UPLOAD_BYTES:
                    raise HTTPException(
                        status_code=413,
                        detail=f"File too large (max {MAX_UPLOAD_BYTES // (1024 * 1024)} MB).",
                    )
                out.write(chunk)
    except HTTPException:
        if os.path.exists(dest):
            os.remove(dest)
        raise
    finally:
        await file.close()

    if size == 0:
        os.remove(dest)
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    # Validate by loading it in Blender (bpy); drop the file if it's not a model.
    try:
        validate_model(dest)
    except HTTPException:
        if os.path.exists(dest):
            os.remove(dest)
        raise

    return upload_payload(request, filename, size)

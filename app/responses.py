"""Shared shape for an uploaded-file payload, used by /api/upload and /api/files."""

import os

from fastapi import Request

from app.config import STATIC_MOUNT, UPLOAD_DIR


def upload_payload(request: Request, filename: str, size: int | None = None) -> dict:
    """Build the JSON payload describing one file under public/upload/."""
    if size is None:
        size = os.path.getsize(os.path.join(UPLOAD_DIR, filename))
    url = f"{STATIC_MOUNT}/upload/{filename}"
    return {
        "filename": filename,
        "size": size,
        "url": url,
        "absolute_url": str(request.base_url).rstrip("/") + url,
    }

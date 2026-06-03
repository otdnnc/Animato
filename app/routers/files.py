"""List endpoint: return every uploaded model under public/upload/."""

import os

from fastapi import APIRouter, Request

from app.config import ALLOWED_EXTENSIONS, UPLOAD_DIR
from app.responses import upload_payload

router = APIRouter(prefix="/api", tags=["files"])


@router.get("/files")
async def list_files(request: Request):
    """Return all uploaded files, each shaped like the /api/upload response."""
    files = []
    for name in sorted(os.listdir(UPLOAD_DIR)):
        path = os.path.join(UPLOAD_DIR, name)
        ext = os.path.splitext(name)[1].lower()
        if os.path.isfile(path) and ext in ALLOWED_EXTENSIONS:
            files.append(upload_payload(request, name))
    return files

"""Animation endpoint: delete a named clip from an uploaded model.

This is a plain, deterministic operation — fixed bpy Python in app/animation_worker.py,
NOT AI-generated code. We run that worker in a separate process (like /api/run) so a
bpy crash or the heavy import/export can't take down the server; the animated file is
overwritten in place and its URL returned so the client can reload the viewer.
"""

import os
import subprocess
import sys

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.config import ROOT_DIR, STATIC_MOUNT, UPLOAD_DIR

router = APIRouter(prefix="/api", tags=["animation"])

# import bpy + import_scene + export can be slow; mirror /api/run's patience.
REMOVE_TIMEOUT_SECONDS = 300

WORKER = os.path.join(ROOT_DIR, "app", "animation_worker.py")


class RemoveAnimationRequest(BaseModel):
    filename: str           # name of a file already in public/upload/
    name: str               # the animation clip name to delete


@router.post("/animation/remove")
async def remove_animation(req: RemoveAnimationRequest):
    """Delete the clip named `name` from the upload and return {ok, output_url}."""
    # basename() blocks path traversal: only files inside public/upload/ are reachable.
    name = os.path.basename(req.filename)
    path = os.path.join(UPLOAD_DIR, name)
    if not name or not os.path.isfile(path):
        raise HTTPException(status_code=404, detail=f"File not found in upload folder: {name}")
    if not req.name.strip():
        raise HTTPException(status_code=400, detail="Missing animation name.")

    try:
        proc = subprocess.run(
            [sys.executable, WORKER, path, req.name],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            timeout=REMOVE_TIMEOUT_SECONDS,
        )
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=400, detail="Removing the animation timed out.")

    # The worker uses exit code 3 specifically for "no clip matched that name".
    if proc.returncode == 3:
        raise HTTPException(status_code=404, detail=f"Animation not found: {req.name}")
    if proc.returncode != 0:
        detail = proc.stderr.strip() or f"Failed to remove animation (exit {proc.returncode})."
        raise HTTPException(status_code=400, detail=detail)

    # Same path was overwritten, so its public URL is unchanged.
    return {"ok": True, "output_url": f"{STATIC_MOUNT}/upload/{name}"}

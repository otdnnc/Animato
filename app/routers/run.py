"""Run endpoint: execute AI-generated bpy code that exports the animated model.

Flow: the web client gets a prompt from /api/prompt, pastes it into an AI coding
assistant, and the AI returns a self-contained bpy script. The client POSTs that
script here either as JSON {code: ...} or as a raw text/plain body (paste it
verbatim, no escaping); we run it headlessly so it animates the rig and
OVERWRITES the original uploaded model in place, then return that file's URL for
web preview.

SECURITY: this executes arbitrary Python posted by the client — it is a remote
code-execution endpoint by design (the whole point is to run AI-generated code).
Only expose it on a trusted/local network. We run the code in a SEPARATE process
(not in-process) so a bpy segfault or runaway script can't take down the server,
and the server's own bpy state stays clean.
"""

import json
import os
import subprocess
import sys
import tempfile
import time

from fastapi import APIRouter, HTTPException, Request

from app.config import PUBLIC_DIR, ROOT_DIR, STATIC_MOUNT

router = APIRouter(prefix="/api", tags=["run"])

# bpy import + import_scene + export can be slow on a cold start.
RUN_TIMEOUT_SECONDS = 300

# 3D files the script might write (it overwrites the original upload in place).
MODEL_EXTENSIONS = (".glb", ".gltf", ".fbx", ".obj")


async def _read_code(request: Request) -> str:
    """Pull the bpy script out of the request, accepting two body shapes:

    - JSON  `{"code": "..."}`  — newlines/quotes must be JSON-escaped.
    - raw text (any non-JSON content type) — the body IS the script, pasted
      verbatim with NO escaping. This is the easy path for pasting AI output,
      since raw multi-line code can't legally sit inside a JSON string.
    """
    raw = await request.body()
    text = raw.decode("utf-8", errors="replace")
    ctype = request.headers.get("content-type", "")

    if "application/json" in ctype:
        try:
            data = json.loads(text)
        except json.JSONDecodeError as e:
            raise HTTPException(
                status_code=400,
                detail=(
                    f"Invalid JSON body: {e}. Raw newlines aren't allowed inside a "
                    "JSON string — either JSON-escape the code (\\n, \\\", ...), or "
                    "POST it as a plain-text body with Content-Type: text/plain."
                ),
            )
        if not isinstance(data, dict) or "code" not in data:
            raise HTTPException(status_code=400, detail="JSON body must be {\"code\": \"...\"}.")
        return data["code"] or ""

    # Non-JSON: treat the whole body as the script.
    return text


def _strip_code_fences(code: str) -> str:
    """Tolerate code that still has surrounding ```python ... ``` markdown fences."""
    text = code.strip()
    if not text.startswith("```"):
        return text
    lines = text.splitlines()
    # drop the opening fence line (```), e.g. "```python"
    lines = lines[1:]
    # drop the closing fence line if present
    if lines and lines[-1].strip().startswith("```"):
        lines = lines[:-1]
    return "\n".join(lines).strip()


def _model_snapshot() -> dict:
    """Map every 3D file under public/ to its mtime, so we can spot what a run wrote."""
    snap = {}
    for root, _dirs, files in os.walk(PUBLIC_DIR):
        for name in files:
            if name.lower().endswith(MODEL_EXTENSIONS):
                p = os.path.join(root, name)
                try:
                    snap[p] = os.path.getmtime(p)
                except OSError:
                    pass
    return snap


def _public_url(path: str) -> str:
    """Turn an absolute path under public/ into its /public/... served URL."""
    rel = os.path.relpath(path, PUBLIC_DIR).replace(os.sep, "/")
    return f"{STATIC_MOUNT}/{rel}"


@router.post("/run")
async def run_code(request: Request):
    """Execute posted bpy code; return {ok, returncode, stdout, stderr, output_url}.

    Accepts either JSON `{"code": "..."}` or a raw text/plain body (the script
    pasted verbatim). See _read_code for why the raw-body form is the easy path.
    """
    code = _strip_code_fences(await _read_code(request))
    if not code:
        raise HTTPException(status_code=400, detail="No code provided.")

    before = _model_snapshot()
    started = time.time()

    # Write the script to a temp file and run it with the SAME interpreter (the one
    # that has bpy installed). cwd=ROOT_DIR so any relative paths resolve sensibly.
    fd, script_path = tempfile.mkstemp(suffix=".py", prefix="anim_run_")
    try:
        with os.fdopen(fd, "w") as fp:
            fp.write(code)
        try:
            proc = subprocess.run(
                [sys.executable, script_path],
                cwd=ROOT_DIR,
                capture_output=True,
                text=True,
                timeout=RUN_TIMEOUT_SECONDS,
            )
        except subprocess.TimeoutExpired:
            raise HTTPException(
                status_code=400,
                detail=f"Code timed out after {RUN_TIMEOUT_SECONDS}s.",
            )
    finally:
        if os.path.exists(script_path):
            os.remove(script_path)

    # Find a 3D file the run created or overwrote (newest one wins).
    after = _model_snapshot()
    produced = [
        p for p, mtime in after.items()
        if mtime >= started - 1 and (p not in before or before[p] != mtime)
    ]
    produced.sort(key=lambda p: after[p], reverse=True)
    output_url = _public_url(produced[0]) if produced else None

    return {
        "ok": proc.returncode == 0,
        "returncode": proc.returncode,
        "stdout": proc.stdout,
        "stderr": proc.stderr,
        "output_url": output_url,
    }

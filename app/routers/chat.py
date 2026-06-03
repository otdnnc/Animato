"""Chat endpoint: one-shot chat message → prompt → Gemini → bpy code → run.

The web client holds the user's Gemini settings (API key, endpoint, model) in
its own "Gemini AI settings" modal and never persists them server-side. It POSTs
those credentials together with the uploaded model's filename and the chat
message describing the animation; the BACKEND builds the full animation prompt
(the same one /api/prompt produces), forwards it to Gemini, takes the bpy script
it writes back, and executes it with the SAME runner /api/run uses — so the
animated model overwrites the upload in place and its URL is returned for preview.

This is the automatic counterpart to the manual copy-prompt → paste-code → run
flow: the round trip to the AI happens here instead of in the user's own agent.

SECURITY: the credentials are supplied per-request by the client and used only to
make this one call; nothing is stored. Running the returned code is RCE by design
— see app/routers/run.py.
"""

import httpx
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.routers.prompt import build_prompt_for_upload
from app.routers.run import execute_bpy_code

router = APIRouter(prefix="/api", tags=["chat"])

# Gemini can take a while to produce a long script; keep this under the dev
# server's patience but generous.
GEMINI_TIMEOUT_SECONDS = 120


class ChatTurn(BaseModel):
    role: str               # "user" or "assistant" (as the client labels them)
    content: str            # the turn's text (an assistant turn may carry its code)


class ChatRequest(BaseModel):
    api_key: str            # Gemini API key (from the client's settings modal)
    endpoint: str           # base URL incl. version, e.g. .../v1beta
    model: str              # e.g. "gemini-3-flash-preview"
    filename: str           # name of a file already in public/upload/
    message: str = ""       # chat message: the natural-language animation request
    history: list[ChatTurn] = []  # prior turns, for multi-turn context


def _build_contents(history: list[ChatTurn], prompt: str) -> list[dict]:
    """Map prior chat turns + the fresh prompt into Gemini `contents`.

    Roles are translated to Gemini's vocabulary ("assistant" -> "model"); empty
    turns are dropped. Gemini wants the conversation to open on a user turn, so we
    skip any leading model turns. The freshly built prompt is the final user turn.
    """
    contents: list[dict] = []
    for turn in history:
        text = turn.content.strip()
        if not text:
            continue
        role = "model" if turn.role == "assistant" else "user"
        if not contents and role == "model":
            continue  # conversation must start on a user turn
        contents.append({"role": role, "parts": [{"text": text}]})
    contents.append({"role": "user", "parts": [{"text": prompt}]})
    return contents


def _extract_text(data: dict) -> str:
    """Pull the generated text out of a Gemini generateContent response.

    A candidate's content has one or more parts; we concatenate every part that
    carries text (a script can be split across parts).
    """
    candidates = data.get("candidates") or []
    if not candidates:
        # The model may have refused or been blocked; surface why if we can.
        feedback = data.get("promptFeedback") or {}
        reason = feedback.get("blockReason")
        raise HTTPException(
            status_code=502,
            detail=f"Gemini returned no candidates{f' (blocked: {reason})' if reason else ''}.",
        )
    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts).strip()
    if not text:
        raise HTTPException(status_code=502, detail="Gemini returned an empty response.")
    return text


@router.post("/chat")
async def chat(req: ChatRequest):
    """Build the prompt, send it to Gemini, run the bpy code it returns, report it.

    Returns {code, ok, returncode, stdout, stderr, output_url}: `code` is the raw
    script Gemini produced (so the client can show it), the rest mirrors /api/run.
    """
    if not req.api_key.strip():
        raise HTTPException(status_code=400, detail="Missing Gemini API key.")

    # Build the animation prompt server-side from the upload + the chat message
    # (raises 404 if the file is gone, 400 if the prompt can't be built).
    prompt, _output_url = build_prompt_for_upload(req.filename, req.message)

    # REST: POST {endpoint}/models/{model}:generateContent — the endpoint already
    # carries the API version (e.g. /v1beta), so we only append the model path.
    endpoint = req.endpoint.strip()
    if not endpoint.startswith(("http://", "https://")):
        raise HTTPException(
            status_code=400,
            detail=(
                "Invalid Gemini endpoint "
                f"{endpoint!r}: it must start with http:// or https:// (e.g. "
                "https://generativelanguage.googleapis.com/v1beta). Check the "
                "endpoint field in Gemini AI settings."
            ),
        )
    if not req.model.strip():
        raise HTTPException(status_code=400, detail="Missing Gemini model.")
    url = f"{endpoint.rstrip('/')}/models/{req.model.strip()}:generateContent"
    payload = {"contents": _build_contents(req.history, prompt)}

    try:
        async with httpx.AsyncClient(timeout=GEMINI_TIMEOUT_SECONDS) as client:
            resp = await client.post(
                url,
                headers={"x-goog-api-key": req.api_key.strip()},
                json=payload,
            )
    except httpx.TimeoutException as e:
        # str(e) is often empty for timeouts — say what timed out, and where.
        raise HTTPException(
            status_code=504,
            detail=(
                f"Gemini request timed out after {GEMINI_TIMEOUT_SECONDS}s "
                f"({type(e).__name__}) calling {url}."
            ),
        )
    except httpx.HTTPError as e:
        # Many transport errors (DNS/connect/TLS) have an empty str(); fall back to
        # the exception type and repr so the cause is never blank in the UI.
        cause = str(e) or repr(e)
        raise HTTPException(
            status_code=502,
            detail=f"Could not reach Gemini ({type(e).__name__}): {cause}. URL: {url}",
        )

    if resp.status_code != 200:
        # Bubble up Gemini's own error message (bad key, unknown model, ...).
        detail = resp.text
        try:
            err = resp.json().get("error") or {}
            detail = err.get("message") or detail
        except Exception:
            pass
        raise HTTPException(status_code=resp.status_code, detail=f"Gemini error: {detail}")

    code = _extract_text(resp.json())

    # Run it exactly like a pasted script; execute_bpy_code strips any ``` fences.
    result = execute_bpy_code(code)
    return {"code": code, **result}

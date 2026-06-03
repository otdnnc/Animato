<div align="center">

# 🕺 Animato

### Animate a 3D character with AI — at zero cost, on your own machine.

Describe a motion in plain English → get a playable animation back.<br>
**No Blender. No GPU. No subscription. One AI inference per animation.**

<br>

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
![Python 3.13](https://img.shields.io/badge/Python-3.13-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB)
![three.js](https://img.shields.io/badge/three.js-000000?logo=three.js&logoColor=white)
![Blender bpy](https://img.shields.io/badge/Blender-bpy_5.x-F5792A?logo=blender&logoColor=white)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

<br>

<img src="images/preview.gif" alt="Animato in action — upload a rigged model, describe a motion, watch it animate" width="100%">

</div>

A local, open-source tool that turns a static rigged model
(`.fbx` / `.gltf` / `.obj`) into a **playable animation** using an AI as a small
code-writing **agent** — without opening Blender, and without paying a cent to an
LLM provider.

You upload a model, the server inspects its skeleton and builds an exhaustive
**prompt**. An AI reads that prompt and writes a tiny `bpy` (Blender Python)
script. The server runs that script **headless** to bake the animation into the
file. The AI never runs Blender, never touches your machine, and never sees more
than the text you hand it — it only produces a few dozen lines of Python.

```
upload model ──► /api/prompt ──► (AI writes a bpy script) ──► /api/run executes it
                                                                      │
 web preview ◄── /public/upload/<file> ◄──────────────────────────────┘
        (same URL as the upload — now animated)
```

---

## ✨ Highlights

|   | |
|---|---|
| 🆓 **Truly zero-cost** | Use any free chat AI (copy/paste) or a free-tier API key. No subscription, no credit card. |
| 🧠 **One inference, not an agent storm** | The AI's whole job is to write *one* short `bpy` script. No retry loops burning your quota. |
| 💻 **Heavy lifting runs locally** | Loading, baking, exporting all run on **your CPU** via headless Blender. No Blender install needed. |
| 🎯 **One-shot accuracy** | The prompt ships the full skeleton, axes, units & a bpy 5.x cheat-sheet, so the model gets it right first try. |
| 🔌 **Bring your own AI** | Gemini, ChatGPT, Claude, DeepSeek, or a local LM Studio / Ollama model — anything that writes Python. |
| 👀 **Live three.js preview** | The built-in editor plays the baked animation instantly in the browser. |
| 📦 **Standard formats in & out** | `.fbx`, `.gltf` / `.glb`, `.obj` — the animation bakes straight into the file. |

---

## 📑 Table of contents

- [Quick start](#-quick-start)
- [Why this exists](#why-this-exists--use-ai-less-not-more)
- [Two ways to drive the AI](#two-ways-to-drive-the-ai--both-free)
- [How it works](#how-it-works)
- [Setup](#setup)
- [Running](#running)
- [API reference](#api)
- [Previewing in three.js](#previewing-the-animation-in-threejs)
- [Notes on formats](#notes-on-formats)
- [Contributing](#contributing)
- [License](#license)

---

## Why this exists — use AI *less*, not more

Most "AI agent" tools treat the model as a furnace: one user prompt fans out into
dozens of speculative calls, each keeping a GPU cluster busy for **5–10 minutes**.
That burns the developer's wallet and the planet's carbon budget at the same
time, and it's mostly **unnecessary**. Providers are happy to subsidize that
habit — they lose money per call today so you depend on them tomorrow.

This project is built on the opposite bet:

- **Understand what the AI actually does.** Here, the AI's *entire* job is to
  write one short Python script. That's a single, cheap inference — not an agent
  loop chewing through your quota.
- **Do the heavy lifting locally.** All the expensive work — loading the model,
  reading the skeleton, baking keyframes, exporting — runs on **your CPU** via
  `bpy`. No tokens spent on it.
- **Give the AI everything up front.** The prompt already contains the scene
  units, every bone, local axes, head→tail directions, and a correct API
  cheat-sheet. A well-fed model gets it right in **one shot**, so there's no
  retry storm. Less inference time = less server load = less heat.
- **Spend nothing.** Use a **free LLM web UI** (copy the prompt in, paste the
  code back) or a **free-tier API key**. No subscription, no credit card.

> Use an LLM the way you'd use any expensive shared resource: deliberately, once,
> with enough context to get the answer the first time.

---

## Two ways to drive the AI — both free

You never need a paid plan. Pick whichever you prefer:

### 1. Manual — zero key, any chat AI (fully free)

1. Build the prompt (`POST /api/prompt`, or the **Manual prompt** dialog in the
   editor) and **copy** it.
2. Paste it into any free AI web interface — Gemini, ChatGPT, Claude, DeepSeek,
   a local model in LM Studio / Ollama, whatever you already have open.
3. Copy the Python script it replies with.
4. Paste it back and **Run** (`POST /api/run`). Done.

No API key, no billing — just the copy/paste you'd do anyway.

### 2. Automatic — free-tier API key (the agent loop)

Paste a **free** API key into the editor's **Gemini AI settings** once. The app
then does the round trip for you: it builds the prompt, calls the model, and runs
the returned script automatically (`POST /api/chat`). Google's
`generativelanguage` API has a **free tier** that's plenty for occasional
animation work; the key lives only in your browser's `localStorage` and is sent
per-request — never stored on the server.

> Either way it's **one inference per animation**. No background polling, no
> hidden agent that quietly racks up calls.

---

## How it works

1. **Upload** a rigged model → `POST /api/upload`. It's validated by actually
   loading it in `bpy`, then stored under `public/upload/`.
2. **Build the prompt** → `POST /api/prompt`. The server loads the model in
   Blender and dumps *everything* the AI needs: scene units, the armature, every
   bone (name, parent, local axes, head→tail direction), any existing animation,
   plus a **bpy 5.x API cheat-sheet** (to stop the AI emitting removed ≤3.x calls)
   and a strict task spec.
3. **Generate code** — manually (copy/paste into any AI) or automatically (`/api/chat`
   with a free key). The prompt forces **one** self-contained Python script that:
   - imports the model from the exact path given,
   - keyframes the pose bones to produce the motion,
   - sets the frame range + fps,
   - **exports with animation baked in** (`export_animations=True` for glTF,
     `bake_anim=True` for FBX), **overwriting the original file** in place.
4. **Run it** → `POST /api/run`. The server runs the script in a **separate
   process** (so a `bpy` crash can't take down the API), the file is overwritten
   with its animated version, and the endpoint returns its `output_url`.
5. **Preview** — the editor loads that URL in a live three.js viewer and plays
   the animation. You can also delete clips (`POST /api/animation/remove`) with
   fixed, non-AI Python.

The key idea: **the AI only produces text.** The server runs that text with `bpy`
to bake the animation into the model file, which a web viewer then plays.

> **Heads-up — overwrite is destructive.** The generated script replaces your
> original upload with the animated version. If the AI's code is wrong, the
> source file is lost; keep a copy of anything you can't re-upload.

---

## 🚀 Quick start

```bash
# 1. clone
git clone https://github.com/otdnnc/animato.git
cd animato

# 2. backend deps (bpy, fastapi, …) — no Blender install needed
uv sync

# 3. build the web UI into ../public/
cd frontend && bun install && bun run build && cd ..

# 4. run everything on one origin
uv run fastapi run main.py        # ← open http://localhost:8000
```

Then in the browser: **upload a rigged model → type "wave hello" → Run → watch it animate.**

> New here? Read [How it works](#how-it-works) for the one-inference design, or jump to
> [development mode](#development--two-servers-with-hot-reload) for hot reload.

---

## Setup

### Backend (Python + bpy)

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/). `bpy` (Blender as a
Python module) is a project dependency, so **no Blender install is needed** — it
runs headless inside the venv.

```bash
uv sync                          # install backend deps (bpy, fastapi, ...)
```

### Frontend (Vite + React)

Requires Node.js 20+. Any package manager works ([bun](https://bun.sh) is fastest
given the committed `bun.lock`):

```bash
cd frontend
bun install                      # or: npm install
```

---

## Running

### Production — one server (recommended)

Build the SPA into `public/` and let FastAPI serve everything (UI + API) on a
single origin at **http://localhost:8000**:

```bash
# 1. build the web UI into ../public/ (keeps public/upload/ intact)
cd frontend
bun run build                    # or: npm run build

# 2. serve the API and the built UI together
cd ..
uv run fastapi run main.py       # http://localhost:8000  ← open this
```

FastAPI serves the built `index.html` as the home page, serves `/assets/*`, and
falls back to `index.html` for client routes (so refreshing `/editor` works). The
production build talks to its **own origin**, so there's nothing else to
configure.

### Development — two servers with hot reload

Run the backend and the Vite dev server side by side. The dev UI runs on `:5173`
and calls the API on `:8000` (allowed via CORS):

```bash
# terminal 1 — backend with auto-reload
uv run fastapi dev main.py       # http://localhost:8000

# terminal 2 — Vite dev server with HMR
cd frontend
bun run dev                      # http://localhost:5173  ← open this
```

Point the UI at a different backend with `VITE_API_URL` (e.g. in `frontend/.env`):

```bash
VITE_API_URL=http://localhost:9000
```

---

## API

Base URL: `http://localhost:8000`. Uploaded and exported files are served under
`/public/...`.

### `POST /api/upload`
Multipart upload of a `.fbx` / `.gltf` / `.obj`. Validates it via `bpy`, stores
it under `public/upload/`.

```bash
curl -F "file=@'public/assets/X Bot.fbx'" http://localhost:8000/api/upload
```
```json
{ "filename": "X-Bot.fbx", "size": 1234567,
  "url": "/public/upload/X-Bot.fbx",
  "absolute_url": "http://localhost:8000/public/upload/X-Bot.fbx" }
```

### `GET /api/files`
List every uploaded model (same shape as the upload response).

### `POST /api/prompt`
Build the AI-animation prompt for a previously uploaded model.

| field      | type   | meaning                                                 |
|------------|--------|---------------------------------------------------------|
| `filename` | string | a file already in `public/upload/`                      |
| `message`  | string | natural-language animation request, e.g. `"wave hello"` |

```bash
curl -X POST http://localhost:8000/api/prompt \
  -H 'Content-Type: application/json' \
  -d '{"filename": "X-Bot.fbx", "message": "wave hello"}'
```

`prompt` is the text you paste into **any** AI assistant. `output_url` is the
model's URL — the **same** as the upload, because the generated code overwrites
the file in place.

### `POST /api/run`
Execute the bpy script the AI produced. Surrounding ```` ```python ```` fences are
tolerated. Runs in a separate process with a 300 s timeout.

- **Raw text** (recommended) — `Content-Type: text/plain`, body is the script
  verbatim. No escaping needed.
- **JSON** — `{"code": "..."}` (newlines/quotes/backslashes must be escaped).

```bash
curl -X POST http://localhost:8000/api/run \
  -H 'Content-Type: text/plain' \
  --data-binary @animate.py
```
```json
{ "ok": true, "returncode": 0, "stdout": "...", "stderr": "...",
  "output_url": "/public/upload/X-Bot.fbx" }
```

A **failed** script still returns HTTP 200 with `ok: false` — inspect `ok`, not
the status code.

### `POST /api/chat`
The automatic path: build the prompt, send it to a free LLM, run the script it
returns. Credentials are supplied per-request and **never stored**.

| field      | type   | meaning                                                   |
|------------|--------|-----------------------------------------------------------|
| `api_key`  | string | your free API key (from the editor's settings modal)      |
| `endpoint` | string | API base incl. version, e.g. `.../v1beta`                 |
| `model`    | string | e.g. `gemini-3-flash-preview`                             |
| `filename` | string | a file already in `public/upload/`                        |
| `message`  | string | the animation request                                     |
| `history`  | array  | prior `{role, content}` turns, for multi-turn context     |

Returns `{code, ok, returncode, stdout, stderr, output_url}` — `code` is the raw
script the model produced; the rest mirrors `/api/run`.

### `POST /api/animation/remove`
Delete a named animation clip from an uploaded model. This is **fixed,
deterministic `bpy` — no AI involved**. Overwrites the file in place.

```json
{ "filename": "X-Bot.fbx", "name": "wave" }
```

> **Security:** `/api/run` (and `/api/chat`, which runs the model's output)
> executes arbitrary Python — it is a remote-code-execution endpoint **by
> design**. Running in a child process isolates `bpy` crashes but does **not**
> sandbox the code. Keep this on a trusted/local machine; do not expose it
> publicly without a sandbox.

---

## Previewing the animation in three.js

The editor already does this for you, but the same approach works in any page.
The animated file carries the skinned skeleton **and** the baked clip. Use the
loader matching the format — `GLTFLoader` for `.glb`/`.gltf`, `FBXLoader` for
`.fbx` — then drive it with an `AnimationMixer`.

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

let mixer = null;
const clock = new THREE.Clock();

new GLTFLoader().load('/public/upload/X-Bot.glb', (gltf) => {
  scene.add(gltf.scene);
  if (gltf.animations.length) {
    mixer = new THREE.AnimationMixer(gltf.scene);
    mixer.clipAction(gltf.animations[0]).play();   // loops by default
  }
});

renderer.setAnimationLoop(() => {
  if (mixer) mixer.update(clock.getDelta());        // advance the animation
  renderer.render(scene, camera);
});
```

For `.fbx`, use `FBXLoader` (it returns the object directly, with `.animations`
holding the clips) and note FBX is often authored in centimetres
(`model.scale.setScalar(0.01)` if it loads huge).

Key points:

- The clip lives in **`.animations`** — an array of `AnimationClip`s. You **must**
  call `mixer.update(delta)` every frame or the model stays frozen on frame 0.
- Apply the mixer to the **loaded root** (`gltf.scene` / the FBX `model`).
- `.play()` loops by default; use `action.setLoop(THREE.LoopOnce)` for one-shot.

For the absolute simplest glTF preview, Google's `<model-viewer>` plays a `.glb`
with one tag (`<model-viewer src="…" autoplay camera-controls>`); it doesn't load
`.fbx`.

---

## Notes on formats

The animated file keeps the uploaded format. `.glb`/`.gltf` is the simplest to
preview in the browser; animated `.fbx` also works via `FBXLoader`. **`.obj` has
no skeleton, so it can't be animated.**

---

## Contributing

Issues and PRs are welcome — bug reports, new format support, prompt tweaks that
improve one-shot accuracy, or editor UX. Keep changes focused and the README in
sync. There's no CLA; by contributing you agree your work ships under the MIT
license below.

---

## License

MIT. Open source, no cost, run it locally. 🌍

<div align="center">

**If this saved you a Blender session — or an LLM bill — consider leaving a ⭐**

<sub>Built to use AI deliberately: once, with enough context to get it right.</sub>

</div>

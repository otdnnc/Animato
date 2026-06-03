# 3d-anim-ai-maker

Turn a static 3D character into a **playable animation** using an AI coding
assistant — without anyone needing to open Blender.

You upload a rigged model (`.fbx` / `.gltf` / `.obj`), the server inspects its
skeleton and builds an exhaustive **prompt**. You paste that prompt into any AI
coding assistant (Gemini, ChatGPT, Claude, …), which writes a small `bpy` script.
You send that script back to the server, it runs **headless** (no Blender GUI),
and the script bakes the animation into the model and **overwrites the original
upload in place** — so the same file URL now serves the animated version, ready
for a web 3D viewer to play.

```
upload model ──► /api/prompt ──► (paste prompt into an AI) ──► AI returns bpy code
                                                                      │
 web preview ◄── /public/upload/<file> ◄── /api/run executes the code ◄┘
        (same URL as the upload — now animated)
```

The key idea: the AI never runs Blender and never sees your machine. It only
produces text (Python). The **server** runs that Python with `bpy` to bake the
animation into the model file, which a web viewer (three.js / `<model-viewer>`)
then plays.

> **Format & web preview.** The animated file keeps the uploaded format. For the
> simplest in-browser preview, upload **`.glb`/`.gltf`** — three.js loads it with
> `GLTFLoader` and `<model-viewer>` plays it directly. Animated **`.fbx`** also
> works in three.js via `FBXLoader`. (`.obj` has no skeleton, so it can't be
> animated.)
>
> **Heads-up — overwrite is destructive.** The generated script replaces your
> original upload with the animated version. If the AI's code is wrong, the
> source file is lost; keep a copy of anything you can't re-upload.

---

## How it works

1. **Upload** a rigged model → `POST /api/upload`. It's validated by actually
   loading it in `bpy`, then stored under `public/upload/`.
2. **Build the prompt** → `POST /api/prompt`. The server loads the model in
   Blender and dumps *everything* the AI needs to animate it: scene units, the
   armature, every bone (name, parent, local axes, head→tail direction), any
   existing animation, plus a **bpy 5.x API cheat-sheet** (to stop the AI from
   emitting removed ≤3.x calls) and a strict task spec.
3. **Generate code** — you paste the returned prompt into an AI coding assistant.
   The prompt forces it to reply with **one** self-contained Python script that:
   - imports the model from the exact path given,
   - keyframes the pose bones to produce the motion,
   - sets the frame range + fps,
   - and **exports with animation baked in** (`export_animations=True` for glTF,
     `bake_anim=True` for FBX), **overwriting the original file** at the exact
     path the prompt specified.
4. **Run it** → `POST /api/run` with `{code: "<the AI's script>"}`. The server
   runs the script in a **separate process** (so a `bpy` crash can't take down
   the API), the script overwrites the model file with its animated version, and
   the endpoint returns its `output_url`.
5. **Preview** — the client loads that URL (unchanged from the upload) in a web
   viewer and plays the animation (see
   [Playing the animation in three.js](#playing-the-animation-in-threejs)).

---

## Project layout

```
main.py                 FastAPI app — mounts /public and wires the routers
app/
  config.py             paths, allowed extensions, upload size cap
  validation.py         validate an upload by loading it in bpy
  responses.py          shared JSON shape for uploaded files
  routers/
    health.py           GET  /api/health
    upload.py           POST /api/upload   (store + validate a model)
    files.py            GET  /api/files    (list uploaded models)
    prompt.py           POST /api/prompt   (build the AI prompt)
    run.py              POST /api/run      (execute AI-generated bpy code)
prompting/              builds the prompt from a model (no files written)
  builder.py            assembles all sections into the final prompt text
  config.py             PromptConfig (model_path, animation, full, output_path)
  loader.py             import a model into the current bpy scene
  formatting.py         compact float / vector / matrix formatting
  sections/             one module per prompt section
    scene.py            scene units / fps
    objects.py          object list
    meshes.py           mesh + vertex-group summary
    armatures.py        armature + per-bone data (the core of the prompt)
    animation.py        existing baked animation, if any
    recipe.py           CORRECT bpy 5.x API cheat-sheet (incl. glTF/FBX export)
    instructions.py     the strict task spec the AI must follow
public/
  assets/               sample model(s), e.g. "X Bot.fbx"
  upload/               uploaded models (overwritten in place once animated)
```

---

## Setup

Requires Python 3.13 and [uv](https://docs.astral.sh/uv/). `bpy` (Blender as a
Python module) is a project dependency, so **no Blender install is needed** — it
runs headless inside the venv.

```bash
uv sync                          # install deps (bpy, fastapi, ...)
uv run fastapi dev main.py       # dev server with auto-reload at :8000
# uv run fastapi run main.py     # production
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

| field      | type   | meaning                                              |
|------------|--------|------------------------------------------------------|
| `filename` | string | a file already in `public/upload/`                   |
| `message`  | string | natural-language animation request, e.g. `"wave hello"` |

```bash
curl -X POST http://localhost:8000/api/prompt \
  -H 'Content-Type: application/json' \
  -d '{"filename": "X-Bot.fbx", "message": "wave hello"}'
```
```json
{ "prompt": "==== 3D MODEL CONTEXT FOR AI ANIMATION ... ",
  "output_url": "/public/upload/X-Bot.fbx" }
```

`prompt` is the text you paste into the AI assistant. `output_url` is the model's
URL — the **same** as the upload, because the generated code overwrites the file
in place. After you run that code, this URL serves the animated version.

### `POST /api/run`
Execute the bpy script the AI produced. Surrounding ```` ```python ```` fences are
tolerated. The script runs in a separate process with a 300 s timeout.

Accepts the script in **either** of two body shapes:

- **Raw text** (recommended) — `Content-Type: text/plain`, body is the script
  pasted verbatim. No escaping needed. Use this for pasted AI output.
- **JSON** — `{"code": "..."}`. Note JSON strings can't contain literal newlines,
  so every line break/quote/backslash must be escaped (`\n`, `\"`, `\\`). Pasting
  raw multi-line code into this form fails with a `json_invalid` error — use the
  raw-text body instead, or `JSON.stringify(code)` on the client.

```bash
# easy path: post the script file verbatim as text/plain
curl -X POST http://localhost:8000/api/run \
  -H 'Content-Type: text/plain' \
  --data-binary @animate.py
```
```json
{ "ok": true, "returncode": 0,
  "stdout": "...", "stderr": "...",
  "output_url": "/public/upload/X-Bot.fbx" }
```

On success, load `output_url` in a web viewer to play the animation. `output_url`
is detected as the 3D file the run overwrote (it matches the upload's URL).

> **Security:** `/api/run` executes arbitrary Python posted by the client — it is
> a remote-code-execution endpoint by design (the whole point is to run
> AI-generated code). Only expose it on a trusted/local network. Running in a
> child process isolates `bpy` crashes from the API but does **not** sandbox the
> code; do not expose this publicly without a sandbox.

---

## Playing the animation in three.js

The animated file carries the skinned skeleton **and** the animation clip (baked
from the keyframed action on export). Use the loader that matches the file's
format — `GLTFLoader` for `.glb`/`.gltf`, `FBXLoader` for `.fbx` — then drive it
with an `AnimationMixer`.

### glTF (`.glb` / `.gltf`)

```js
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene    = new THREE.Scene();
const camera   = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 1000);
camera.position.set(0, 1.4, 3);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
document.body.appendChild(renderer.domElement);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.5));

let mixer = null;
const clock = new THREE.Clock();

new GLTFLoader().load('/public/upload/X-Bot.glb', (gltf) => {
  scene.add(gltf.scene);

  // gltf.animations holds the clip(s) baked into the file on export.
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

### FBX (`.fbx`)

Same idea, but `FBXLoader` returns the object directly and its `.animations`
holds the clips:

```js
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

new FBXLoader().load('/public/upload/X-Bot.fbx', (model) => {
  scene.add(model);
  if (model.animations.length) {
    mixer = new THREE.AnimationMixer(model);
    mixer.clipAction(model.animations[0]).play();
  }
});
// FBX is often authored in centimetres — model.scale.setScalar(0.01) if it's huge.
```

Key points:

- The animation lives in **`.animations`** (`gltf.animations` / `model.animations`)
  — an array of `AnimationClip`s. Use an `AnimationMixer` to play one; you **must**
  call `mixer.update(delta)` every frame or the model stays frozen on frame 0.
- Apply the mixer to the **loaded root** (`gltf.scene` / the FBX `model`), so the
  bones it drives are the ones in the scene graph.
- `.play()` loops the clip by default; use `action.setLoop(THREE.LoopOnce)` for a
  one-shot, or `action.timeScale` to change speed.

### Even simpler: `<model-viewer>` (glTF only)

If the file is `.glb`/`.gltf` and you don't want to write three.js yourself,
Google's web component plays it with one tag:

```html
<script type="module"
  src="https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js"></script>

<model-viewer
  src="/public/upload/X-Bot.glb"
  autoplay
  camera-controls
  shadow-intensity="1">
</model-viewer>
```

`autoplay` starts the embedded clip immediately; `camera-controls` lets the user
orbit. This is the fastest way to confirm an exported glTF animation plays.
(`<model-viewer>` doesn't load `.fbx` — convert to `.glb` or use the three.js
`FBXLoader` path above.)

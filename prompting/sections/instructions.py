"""## YOUR TASK (instructions to the AI) section."""

import os


def _export_lines(path):
    """The exact exporter call to write `path`, matching its file extension.

    The animated result OVERWRITES the original upload (same path + format), so
    the export format is dictated by the file's extension, not chosen freely.
    """
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        fmt = "GLB" if ext == ".glb" else "GLTF_SEPARATE"
        return [
            "   bpy.ops.export_scene.gltf(",
            f"       filepath={path!r},",
            f"       export_format={fmt!r},",
            "       export_animations=True,   # bake the keyframed action into the file",
            "       export_yup=True,",
            "   )",
        ]
    if ext == ".fbx":
        return [
            "   bpy.ops.export_scene.fbx(",
            f"       filepath={path!r},",
            "       bake_anim=True,           # write the keyframed action into the FBX",
            "       add_leaf_bones=False,",
            "   )",
        ]
    if ext == ".obj":
        return [
            f"   # WARNING: {ext} cannot store a skeleton or animation. This file type is not",
            "   # animatable; the export will not contain motion.",
        ]
    return [f"   # Export to {path!r} using the bpy exporter that matches this extension."]


def section_instructions(cfg):
    request = cfg.animation if cfg.animation else "<describe the animation you want here>"
    return [
        "## YOUR TASK (instructions to the AI)",
        "You are given the COMPLETE static description of a Blender scene + rig above.",
        "Generate a SINGLE self-contained Python script that uses `bpy` to ANIMATE this rig",
        "according to the ANIMATION REQUEST below, and then SAVE (export) the animated result",
        "by OVERWRITING the original model file in place, so there is a single, up-to-date",
        "model file that can be previewed in a web viewer.",
        "",
        "This script runs HEADLESS (`bpy` imported as a module, executed by a plain Python",
        "interpreter). It must NOT open the Blender GUI and must NOT depend on any interactive",
        "Blender session — its only side effect is overwriting the model file with the animated",
        "version.",
        "",
        "ANIMATION REQUEST:",
        f"    {request}",
        "",
        "Hard requirements for the code you output:",
        "1. First clear the default scene, then import the model with",
        "   `bpy.ops.import_scene.fbx(filepath=...)` (or the matching importer for the file type),",
        "   using this EXACT absolute path:",
        f"       {cfg.model_path}",
        "2. Reference bones BY NAME from the lists above. Do not invent bone names.",
        "3. Animate via pose bones: set `pose_bone.rotation_mode` if needed, then keyframe",
        "   `rotation_quaternion`/`rotation_euler`/`location`/`scale` with",
        "   `pose_bone.keyframe_insert(data_path=..., frame=...)`. Operate in POSE mode.",
        "4. Respect each bone's local axes (Y = head->tail) given above when choosing rotation",
        "   axes, so limbs bend in anatomically correct directions.",
        "5. Set `scene.frame_start`, `scene.frame_end`, and `scene.render.fps` for the clip BEFORE",
        "   exporting, so the exporter bakes the full frame range into the file.",
        "6. Keep the model's existing world transform; don't rescale unless asked.",
        "7. Return to OBJECT mode, then EXPORT the whole scene (mesh + armature + animation),",
        "   OVERWRITING the original file at this EXACT path (same path you imported from):",
        f"       {cfg.output_path}",
        "   Use EXACTLY this exporter call (it matches the file's format):",
        *_export_lines(cfg.output_path),
        "8. The script must finish on its own with no GUI and no leftover open file handles.",
        "",
        "OUTPUT FORMAT (so it copies into a file cleanly — IMPORTANT):",
        "- Reply with the ENTIRE script as ONE single fenced code block: a line with ```python,",
        "  then the full script, then a closing ``` line. Nothing else.",
        "- Put NO text, explanation, or comments before the opening ``` or after the closing ```.",
        "- Do NOT split the code into multiple blocks or snippets — one block, one complete file.",
        "- Preserve standard 4-space Python indentation. Use only normal ASCII spaces (no tabs,",
        "  no smart quotes, no non-breaking spaces).",
        "- The block must be the complete file: all imports at top, runnable top-to-bottom as-is",
        "  with no placeholders or '...' to fill in.",
        "",
    ]

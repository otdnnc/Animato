"""Standalone bpy worker: remove a named animation clip from a model, re-export.

This is FIXED Python (no AI, no generated code). app/routers/animation.py runs it
in a separate process so a bpy segfault or the heavy import/export can't take down
the server and the server's own bpy state stays clean — the same isolation /api/run
uses, but here the code is our own.

Usage:
    python -m app.animation_worker <path> <animation-name>

Exit codes:
    0  the clip was removed and the file re-exported in place
    2  unsupported format / bad arguments
    3  no clip matched the given name (nothing changed)
    *  bpy raised (import/export failure) — message on stderr
"""

import os
import sys


def _segments(name: str) -> list[str]:
    """Split a Blender action name into its '|'-separated parts (non-empty)."""
    return [s.strip() for s in name.split("|") if s.strip()]


def _make_matcher(name: str):
    """A predicate matching a Blender action name against the clip name to delete.

    The Blender FBX importer mangles take names (e.g. 'Jump' becomes
    'Armature|Armature|Jump', and a mixamo take becomes
    'Armature|Armature|Armature|mixamo.com|Layer0'), while three.js shows the
    user just one segment of that ('Jump', 'mixamo.com'). So we match when the
    names are equal, share their last segment, or the clip name IS one of the
    action's '|'-segments (and vice-versa).
    """
    target = name.strip()
    target_segs = set(_segments(target))
    target_last = target.split("|")[-1].strip()

    def matches(candidate: str) -> bool:
        if candidate == name:
            return True
        segs = set(_segments(candidate))
        if target in segs or candidate in target_segs:
            return True
        return candidate.split("|")[-1].strip() == target_last
    return matches


def remove_animation(path: str, name: str) -> int:
    """Load `path`, delete every animation matching `name`, re-export over `path`.

    Returns the number of distinct actions removed. Animations imported from glTF
    / FBX become Blender Actions (referenced by the active slot and/or NLA strips),
    so we clear all three places that can hold the clip before re-exporting.
    """
    import bpy  # heavy; only paid for inside the worker process

    ext = os.path.splitext(path)[1].lower()
    if ext not in (".fbx", ".glb", ".gltf"):
        sys.stderr.write(f"Cannot remove animations from '{ext}' files.\n")
        sys.exit(2)

    # Start from an empty scene so nothing from a default file leaks into export.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    else:
        bpy.ops.import_scene.gltf(filepath=path)

    matches = _make_matcher(name)

    removed: set[str] = set()

    # 1) Per-object animation_data: drop matching NLA strips (and the active action).
    for obj in bpy.data.objects:
        ad = obj.animation_data
        if not ad:
            continue
        for track in list(ad.nla_tracks):
            for strip in list(track.strips):
                act = strip.action
                if matches(strip.name) or (act and matches(act.name)):
                    if act:
                        removed.add(act.name)
                    track.strips.remove(strip)
            if not len(track.strips):
                ad.nla_tracks.remove(track)
        if ad.action and matches(ad.action.name):
            removed.add(ad.action.name)
            ad.action = None

    # 2) Remove the action itself from blend data (glTF export emits one animation
    #    per action, so the action must be gone, not just unlinked).
    for act in list(bpy.data.actions):
        if matches(act.name):
            removed.add(act.name)
            bpy.data.actions.remove(act)

    if not removed:
        sys.stderr.write(f"Animation not found: {name}\n")
        sys.exit(3)

    # Leave any non-object mode before exporting (mirrors the export recipe).
    try:
        if bpy.context.mode != "OBJECT":
            bpy.ops.object.mode_set(mode="OBJECT")
    except Exception:
        pass

    # Re-export, OVERWRITING the original upload in place (same path we imported).
    if ext == ".fbx":
        bpy.ops.export_scene.fbx(filepath=path, bake_anim=True, add_leaf_bones=False)
    else:
        bpy.ops.export_scene.gltf(
            filepath=path,
            export_format="GLB" if ext == ".glb" else "GLTF_SEPARATE",
            export_animations=True,
            export_yup=True,
        )

    return len(removed)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.stderr.write("usage: python -m app.animation_worker <path> <name>\n")
        sys.exit(2)
    count = remove_animation(sys.argv[1], sys.argv[2])
    print(f"REMOVED={count}")

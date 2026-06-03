"""## SCENE / UNITS section."""

import os

import bpy

from prompting.formatting import f


def section_scene(cfg):
    sc = bpy.context.scene
    us = sc.unit_settings
    L = []
    L.append("## SCENE / UNITS")
    L.append(f"- source_file: {os.path.basename(cfg.model_path)}")
    L.append(f"- blender_version: {bpy.app.version_string}")
    L.append(f"- fps: {sc.render.fps} (fps_base={f(sc.render.fps_base)})")
    L.append(f"- frame_range: start={sc.frame_start} end={sc.frame_end} current={sc.frame_current}")
    L.append(f"- unit_system: {us.system}  length_unit: {us.length_unit}  scale_length: {f(us.scale_length)}")
    L.append(
        "- IMPORTANT: coordinate system is Blender's right-handed Z-up. "
        "Bone local space convention: bone Y axis points head->tail (the bone's "
        "'roll' rotates around that Y axis), bone Z is the roll/up direction, bone X is side."
    )
    counts = {}
    for o in bpy.data.objects:
        counts[o.type] = counts.get(o.type, 0) + 1
    L.append("- object_counts: " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
    L.append("")
    return L

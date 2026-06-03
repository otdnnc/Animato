"""Assemble the full AI-animation prompt for a 3D model."""

import os

from prompting.config import PromptConfig
from prompting.loader import load_model
from prompting.sections.animation import section_animation
from prompting.sections.armatures import section_armatures
from prompting.sections.instructions import section_instructions
from prompting.sections.meshes import section_meshes
from prompting.sections.objects import section_objects
from prompting.sections.recipe import section_recipe
from prompting.sections.scene import section_scene


def build_prompt(model_path, animation="", full=False, output_path=""):
    """Load `model_path` in Blender and return the full prompt text.

    `animation` is the natural-language request to embed (the CLI's --animation).
    `output_path` is where the AI-generated script must SAVE the animated 3D
    file; empty -> overwrite the original model in place. Returns the prompt
    text; the caller decides what to do with it.
    """
    abs_model = os.path.abspath(model_path)
    if not output_path:
        output_path = abs_model  # overwrite the original upload in place

    cfg = PromptConfig(
        model_path=abs_model,
        animation=(animation or "").strip(),
        full=full,
        output_path=os.path.abspath(output_path),
    )

    load_model(cfg.model_path)

    lines = []
    lines.append("=" * 78)
    lines.append("3D MODEL CONTEXT FOR AI ANIMATION CODE GENERATION")
    lines.append("=" * 78)
    lines.append(
        "Below is an exhaustive dump of a 3D model loaded in Blender (bpy). "
        "Use it to write a headless bpy Python script that animates the rig and then "
        "EXPORTS the animated result by overwriting the original model file for web preview "
        "(it must NOT open the Blender GUI). Angles are in radians, distances in the scene's "
        "length unit, matrices are row-major 4x4."
    )
    lines.append("")

    lines += section_scene(cfg)
    lines += section_objects()
    lines += section_meshes()
    lines += section_armatures(cfg)
    lines += section_animation(cfg)
    lines += section_recipe()
    lines += section_instructions(cfg)

    return "\n".join(lines)

"""Configuration for a single prompt build."""

import os
from dataclasses import dataclass

# Project root (one level up from this prompting/ package).
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_MODEL = os.path.join(ROOT_DIR, "public", "assets", "X Bot.fbx")


@dataclass
class PromptConfig:
    """Inputs that drive how the prompt is rendered, passed to each section
    collector so they stay reusable."""

    model_path: str
    animation: str = ""
    full: bool = False  # verbose dump (per-bone world coords, axes, 4x4 matrices)
    # Where the AI-generated script must SAVE the animated 3D file (a .glb for
    # web preview). Empty -> builder derives "<model_stem>.animated.glb" next to
    # the model. The generated code writes this file headlessly; it never opens
    # the Blender GUI.
    output_path: str = ""

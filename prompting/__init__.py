"""Build an exhaustive AI-animation prompt from a 3D model file (via bpy)."""

from prompting.builder import build_prompt
from prompting.config import DEFAULT_MODEL, PromptConfig

__all__ = ["build_prompt", "PromptConfig", "DEFAULT_MODEL"]

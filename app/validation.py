"""Validate uploaded 3D models by loading them in Blender (bpy)."""

import os

from fastapi import HTTPException


def validate_model(path: str) -> None:
    """
    Validate an uploaded model by actually loading it in Blender (bpy), the same
    way playground/context.py imports a model. If bpy can't open the file (wrong
    format, corrupt, missing buffers, ...) the importer raises and we reject it.

    Raises HTTPException(400) on any failure.
    """
    import bpy  # heavy import; done lazily on the first upload

    ext = os.path.splitext(path)[1].lower()
    try:
        # Start from a clean scene so repeated uploads don't accumulate data.
        bpy.ops.object.select_all(action="SELECT")
        bpy.ops.object.delete()

        if ext == ".fbx":
            bpy.ops.import_scene.fbx(filepath=path)
        elif ext in (".glb", ".gltf"):
            bpy.ops.import_scene.gltf(filepath=path)
        elif ext == ".obj":
            bpy.ops.wm.obj_import(filepath=path)
        else:
            raise ValueError(f"Unsupported file type: {ext}")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid 3D file: {e}")

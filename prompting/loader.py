"""Load a 3D model into the current Blender scene."""

import os

import bpy


def load_model(path):
    # Clean default scene (cube/camera/light) before importing the model.
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

    ext = os.path.splitext(path)[1].lower()
    if ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path)
    elif ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext in (".dae",):
        bpy.ops.wm.collada_import(filepath=path)
    elif ext in (".blend",):
        # append everything from the file's Object collection
        with bpy.data.libraries.load(path) as (src, dst):
            dst.objects = list(src.objects)
        for o in dst.objects:
            if o is not None:
                bpy.context.collection.objects.link(o)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    bpy.context.view_layer.update()

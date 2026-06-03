"""## MESHES (geometry + skinning) section."""

import bpy


def section_meshes():
    meshes = [o for o in bpy.data.objects if o.type == "MESH"]
    if not meshes:
        return []
    L = ["## MESHES (geometry + skinning)"]
    for o in meshes:
        me = o.data
        L.append(f"### MESH '{o.name}'")
        L.append(f"- vertices: {len(me.vertices)}   polygons: {len(me.polygons)}   edges: {len(me.edges)}")
        L.append(f"- materials: {[m.name for m in me.materials] if me.materials else []}")
        uvs = [uv.name for uv in me.uv_layers]
        L.append(f"- uv_layers: {uvs}")
        # vertex groups == bone weight channels (deform targets)
        vg = [g.name for g in o.vertex_groups]
        L.append(f"- vertex_groups ({len(vg)}) [these are the deform bone names]:")
        L.append(f"    {vg}")
        # armature modifier link
        mods = [(m.type, getattr(m.object, "name", None)) for m in o.modifiers]
        L.append(f"- modifiers: {mods}")
        L.append("")
    return L

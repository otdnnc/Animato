"""## OBJECTS (transforms) section."""

import bpy
from mathutils import Vector

from prompting.formatting import mat_rows, vec


def object_block(o):
    L = []
    L.append(f"### OBJECT '{o.name}'  (type={o.type})")
    parent = o.parent.name if o.parent else None
    L.append(f"- parent: {parent}   parent_type: {o.parent_type}")
    L.append(f"- location: {vec(o.location)}")
    L.append(f"- rotation_mode: {o.rotation_mode}")
    L.append(f"- rotation_euler(XYZ, rad): {vec(o.rotation_euler)}")
    L.append(f"- scale: {vec(o.scale)}")
    L.append(f"- dimensions (world, m): {vec(o.dimensions, 4)}")
    # local-space bounding box corners
    bb = [Vector(c) for c in o.bound_box]
    if bb:
        mn = Vector((min(c.x for c in bb), min(c.y for c in bb), min(c.z for c in bb)))
        mx = Vector((max(c.x for c in bb), max(c.y for c in bb), max(c.z for c in bb)))
        L.append(f"- bound_box_local: min={vec(mn, 4)} max={vec(mx, 4)}")
    L.append("- matrix_world:")
    for r in mat_rows(o.matrix_world):
        L.append(f"    {r}")
    return L


def section_objects():
    L = ["## OBJECTS (transforms)"]
    for o in bpy.data.objects:
        L += object_block(o)
        L.append("")
    return L

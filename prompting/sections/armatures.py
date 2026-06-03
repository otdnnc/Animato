"""## ARMATURES (rig / skeleton) section."""

import bpy
from mathutils import Vector

from prompting.formatting import f, mat_rows, vec


def bone_line(bone, roll):
    """Compact one-line rest description of a bone (armature-local space)."""
    direction = (bone.tail_local - bone.head_local).normalized()
    parent = bone.parent.name if bone.parent else "-"
    roll_s = f(roll, 4) if roll is not None else "?"
    return (
        f"  {bone.name} | parent={parent} | head={vec(bone.head_local, 4)} "
        f"tail={vec(bone.tail_local, 4)} | len={f(bone.length, 4)} roll={roll_s} "
        f"| dir={vec(direction, 4)}"
    )


def bone_block(arm, bone, roll):
    """Verbose (--full) rest geometry for one bone, incl. axes + 4x4 matrix."""
    ml = bone.matrix_local
    x_axis = ml.to_3x3() @ Vector((1, 0, 0))
    y_axis = ml.to_3x3() @ Vector((0, 1, 0))  # head->tail direction
    z_axis = ml.to_3x3() @ Vector((0, 0, 1))
    aw = arm.matrix_world
    head_w = aw @ bone.head_local
    tail_w = aw @ bone.tail_local

    L = []
    L.append(f"- {bone.name}")
    L.append(f"    parent: {bone.parent.name if bone.parent else None}   children: {[c.name for c in bone.children]}")
    L.append(f"    head_local: {vec(bone.head_local, 5)}   tail_local: {vec(bone.tail_local, 5)}")
    L.append(f"    head_world: {vec(head_w, 5)}   tail_world: {vec(tail_w, 5)}")
    roll_s = f(roll, 5) if roll is not None else "n/a"
    L.append(f"    length: {f(bone.length, 5)}   roll: {roll_s} rad   use_deform: {bone.use_deform}   connected: {bone.use_connect}")
    L.append(f"    local_axis_X(side): {vec(x_axis, 5)}")
    L.append(f"    local_axis_Y(head->tail): {vec(y_axis, 5)}")
    L.append(f"    local_axis_Z(roll/up): {vec(z_axis, 5)}")
    L.append("    matrix_local(rest, armature space):")
    for r in mat_rows(ml, 5):
        L.append(f"      {r}")
    return L


def section_armatures(cfg):
    arms = [o for o in bpy.data.objects if o.type == "ARMATURE"]
    if not arms:
        return ["## ARMATURES", "- (none found — model has no skeleton/rig)", ""]
    L = ["## ARMATURES (rig / skeleton)"]
    for arm in arms:
        data = arm.data
        bones = data.bones

        # bone.roll only exists on EditBone, so read it once in edit mode
        rolls = {}
        bpy.context.view_layer.objects.active = arm
        bpy.ops.object.mode_set(mode="EDIT")
        for eb in data.edit_bones:
            rolls[eb.name] = eb.roll
        bpy.ops.object.mode_set(mode="OBJECT")
        L.append(f"### ARMATURE OBJECT '{arm.name}'  (data='{data.name}')")
        L.append(f"- total_bones: {len(bones)}")
        if cfg.full:
            L.append("- armature.matrix_world:")
            for r in mat_rows(arm.matrix_world):
                L.append(f"    {r}")
        else:
            L.append(f"- armature.matrix_world rows: {[ '['+', '.join(f(c,4) for c in row)+']' for row in arm.matrix_world ]}")
        roots = [b.name for b in bones if b.parent is None]
        L.append(f"- root_bones: {roots}")

        # hierarchy tree (indented)
        L.append("- bone_hierarchy:")

        def walk(b, depth):
            L.append("    " + "  " * depth + b.name)
            for c in b.children:
                walk(c, depth + 1)

        for r in bones:
            if r.parent is None:
                walk(r, 0)

        # pose-bone settings — collapse the common case, list only exceptions
        modes = {}
        for pb in arm.pose.bones:
            modes[pb.rotation_mode] = modes.get(pb.rotation_mode, 0) + 1
        common_mode = max(modes, key=modes.get)
        L.append(
            f"- pose_bones: {len(arm.pose.bones)} bones, rotation_mode mostly '{common_mode}' "
            f"(distribution {modes}); rest pose = identity (matrix_basis)."
        )
        exceptions = []
        for pb in arm.pose.bones:
            notes = []
            if pb.rotation_mode != common_mode:
                notes.append(f"rotation_mode={pb.rotation_mode}")
            if pb.is_in_ik_chain or pb.lock_ik_x or pb.lock_ik_y or pb.lock_ik_z:
                notes.append(f"ik(in_chain={pb.is_in_ik_chain}, lock=({pb.lock_ik_x},{pb.lock_ik_y},{pb.lock_ik_z}))")
            if pb.constraints:
                notes.append(f"constraints={[c.type for c in pb.constraints]}")
            if notes:
                exceptions.append(f"    {pb.name}: {'; '.join(notes)}")
        if exceptions:
            L.append("  pose_bone exceptions:")
            L += exceptions

        # per-bone rest geometry
        if cfg.full:
            L.append("- bones_rest_geometry (ALL bones, verbose):")
            for b in bones:
                L += bone_block(arm, b, rolls.get(b.name))
        else:
            L.append(
                "- bones_rest (ALL bones; armature-local space, head/tail in scene units, "
                "roll in rad, dir = normalized head->tail = bone local +Y):"
            )
            for b in bones:
                L.append(bone_line(b, rolls.get(b.name)))
        L.append("")
    return L

"""## EXISTING ANIMATION section."""

import re

import bpy

from prompting.formatting import f


def action_fcurves(a):
    """Yield fcurves from an Action across both the legacy and the
    Blender 4.4+/5.x layered (slots/layers/strips/channelbag) API."""
    # legacy flat API
    if hasattr(a, "fcurves") and not getattr(a, "is_action_layered", False):
        for fc in a.fcurves:
            yield fc
        return
    # layered API
    for layer in getattr(a, "layers", []):
        for strip in getattr(layer, "strips", []):
            for slot in getattr(a, "slots", []):
                cb = strip.channelbag(slot) if hasattr(strip, "channelbag") else None
                if cb is None:
                    continue
                for fc in cb.fcurves:
                    yield fc


def section_animation(cfg):
    L = ["## EXISTING ANIMATION"]
    actions = list(bpy.data.actions)
    if not actions:
        L.append("- (no actions present — the model has NO baked animation; you must create motion)")
        L.append("")
        return L
    for a in actions:
        rng = a.curve_frame_range if hasattr(a, "curve_frame_range") else a.frame_range
        fcurves = list(action_fcurves(a))
        L.append(f"### ACTION '{a.name}'  frame_range=({f(rng[0],1)}, {f(rng[1],1)})  fcurves={len(fcurves)}")
        # which slots/datablocks this action drives (layered API)
        slot_names = [getattr(s, "name_display", getattr(s, "identifier", "?")) for s in getattr(a, "slots", [])]
        if slot_names:
            L.append(f"    slots: {slot_names}")
        # summarize: which bones are animated + which property channels appear
        bones_animated = set()
        props = set()
        for fc in fcurves:
            m = re.match(r'pose\.bones\["(.+?)"\]\.(\w+)', fc.data_path)
            if m:
                bones_animated.add(m.group(1))
                props.add(m.group(2))
            else:
                props.add(fc.data_path)
        L.append(f"    animated_channels (properties): {sorted(props)}")
        L.append(f"    animated_bones ({len(bones_animated)}): {sorted(bones_animated)}")
        if cfg.full:
            L.append("    full data_paths:")
            for fc in fcurves:
                L.append(f"      {fc.data_path}[{fc.array_index}]  keyframes={len(fc.keyframe_points)}")
    L.append("")
    return L

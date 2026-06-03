"""Compact number / vector / matrix formatting helpers."""


def f(x, nd=6):
    """Format a float compactly (strip -0.0 and trailing noise)."""
    x = float(x)
    if abs(x) < 1e-7:
        x = 0.0
    return f"{x:.{nd}f}".rstrip("0").rstrip(".") if "." in f"{x:.{nd}f}" else f"{x:.{nd}f}"


def vec(v, nd=6):
    return "(" + ", ".join(f(c, nd) for c in v) + ")"


def mat_rows(m, nd=6):
    """A 4x4 (or 3x3) matrix as a list of row strings."""
    return ["[" + ", ".join(f(c, nd) for c in row) + "]" for row in m]

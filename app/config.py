"""Shared paths and constants for the backend."""

import os

# Project root (one level up from this app/ package).
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUBLIC_DIR = os.path.join(ROOT_DIR, "public")
UPLOAD_DIR = os.path.join(PUBLIC_DIR, "upload")

# Public URL path the static files are mounted under (see main.py).
STATIC_MOUNT = "/public"

# File types the rest of the pipeline (bpy / playground/context.py) can load.
ALLOWED_EXTENSIONS = {".gltf", ".fbx", ".obj"}

# Hard cap so a single upload can't fill the disk (200 MB).
MAX_UPLOAD_BYTES = 200 * 1024 * 1024

# Make sure the upload target exists on import.
os.makedirs(UPLOAD_DIR, exist_ok=True)

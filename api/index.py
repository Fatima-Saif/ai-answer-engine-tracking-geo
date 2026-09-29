import os
import sys

# Ensure project root and backend directory are in sys.path
root_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
backend_dir = os.path.join(root_dir, "backend")

if root_dir not in sys.path:
    sys.path.insert(0, root_dir)
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Import the FastAPI application
from backend.main import app

# Vercel's Python runtime invokes the ASGI app directly

import threading
import uvicorn
import webview
import time
import os
import sys

# Helper to find resources in single-file executable bundles
def get_resource_path(relative_path):
    if hasattr(sys, '_MEIPASS'):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.abspath("."), relative_path)

# Set correct static folder path globally so FastAPI startup works when packaged
os.environ["FRONTEND_DIR"] = get_resource_path("frontend")

# Add backend directory to path
sys.path.append(get_resource_path("backend"))

def start_backend():
    os.environ["PYTHONPATH"] = get_resource_path("backend")
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, log_level="info")

if __name__ == "__main__":
    server_thread = threading.Thread(target=start_backend, daemon=True)
    server_thread.start()

    time.sleep(2.0)

    webview.create_window(
        title="AI Answer Engine Tracking (GEO)",
        url="http://127.0.0.1:8000",
        width=1280,
        height=800,
        resizable=True
    )
    webview.start()

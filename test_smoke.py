import os
import sys

def run_tests():
    print("--- 1. Testing desktop_app.py Compatibility ---")
    import desktop_app
    print("[PASS] desktop_app.py imports successfully with PyWebView intact.")

    print("\n--- 2. Testing Local Mode Database & Endpoints ---")
    from backend.database import SessionLocal, init_db, Setting, Prompt
    from backend.main import get_global_settings, get_dashboard_summary, seed_database_if_empty

    init_db()
    db = SessionLocal()
    seed_database_if_empty(db)

    summary = get_dashboard_summary(db)
    total_p = summary["metrics"]["total_prompts"]
    sov = summary["metrics"]["share_of_voice"]
    total_c = summary["metrics"]["total_citations"]
    print(f"[PASS] Local dashboard summary: {total_p} prompts, {sov}% SoV, {total_c} citations.")

    settings = get_global_settings(db)
    print(f"[PASS] Settings: Brand='{settings.brand_name}', Domain='{settings.target_domain}', Competitors='{settings.competitors}'")
    db.close()

    print("\n--- 3. Testing Vercel Serverless Mode Simulation ---")
    os.environ["VERCEL"] = "1"
    import importlib
    import backend.database
    importlib.reload(backend.database)

    print(f"[PASS] Vercel DATABASE_URL resolved: {backend.database.DATABASE_URL}")
    assert "/tmp/geo_tracker.db" in backend.database.DATABASE_URL

    backend.database.init_db()
    v_db = backend.database.SessionLocal()
    seed_database_if_empty(v_db)
    v_summary = get_dashboard_summary(v_db)
    print(f"[PASS] Serverless /tmp dashboard summary: {v_summary['metrics']['total_prompts']} prompts.")
    v_db.close()

    print("\n--- 4. Testing API Entrypoint (api/index.py) ---")
    from api.index import app as vercel_app
    print(f"[PASS] Vercel ASGI application entrypoint: '{vercel_app.title}'")
    assert vercel_app.title == "AI Answer Engine Tracking (GEO)"

    print("\n==============================================")
    print(" ALL GEO TRACKING SMOKE TESTS PASSED (100%)   ")
    print("==============================================")

if __name__ == "__main__":
    run_tests()

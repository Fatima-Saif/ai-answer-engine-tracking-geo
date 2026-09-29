from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
import os
import sys
import datetime
import random
from pydantic import BaseModel
from typing import List, Optional

# Ensure backend directory is in sys.path
backend_dir = os.path.dirname(os.path.abspath(__file__))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from database import SessionLocal, init_db, Prompt, TrackingLog, Citation, Setting
from scraper import run_geo_extraction

# Initialize DB tables
init_db()

app = FastAPI(title="AI Answer Engine Tracking (GEO)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class PromptCreate(BaseModel):
    query_text: str
    category: str
    frequency_hours: int = 24

class PromptOut(BaseModel):
    id: int
    query_text: str
    category: str
    frequency_hours: int
    created_at: datetime.datetime

    class Config:
        from_attributes = True

class SettingUpdate(BaseModel):
    brand_name: str
    target_domain: str
    serp_api_key: Optional[str] = ""
    competitors: Optional[str] = "globexcorp.com, initech.com, hooli.com"

# Helper to get settings
def get_global_settings(db: Session):
    setting = db.query(Setting).first()
    if not setting:
        setting = Setting(
            brand_name="AcmeCorp",
            target_domain="acmecorp.com",
            serp_api_key="",
            competitors="globexcorp.com, initech.com, hooli.com"
        )
        db.add(setting)
        db.commit()
        db.refresh(setting)
    elif not getattr(setting, "competitors", None):
        setting.competitors = "globexcorp.com, initech.com, hooli.com"
        db.commit()
    return setting

# Helper: execute scraper runs for a prompt
def execute_tracking_runs_for_prompt(prompt_id: int, db: Session):
    prompt = db.query(Prompt).filter(Prompt.id == prompt_id).first()
    if not prompt:
        return
    
    settings = get_global_settings(db)
    engines = ["Google AI Overview", "ChatGPT", "Perplexity"]
    
    for engine in engines:
        result = run_geo_extraction(
            prompt.query_text,
            engine,
            settings.brand_name,
            settings.target_domain,
            settings.serp_api_key,
            settings.competitors or ""
        )
        
        log = TrackingLog(
            prompt_id=prompt.id,
            engine_name=engine,
            snapshot_date=datetime.datetime.utcnow(),
            raw_response=result["raw_response"],
            brand_mentioned=result["brand_mentioned"],
            sentiment=result["sentiment"]
        )
        db.add(log)
        db.commit()
        db.refresh(log)
        
        for cit in result["citations"]:
            citation_obj = Citation(
                log_id=log.id,
                url=cit["url"],
                domain=cit["domain"],
                structural_rank=cit["rank"]
            )
            db.add(citation_obj)
        db.commit()

# REST Endpoints
@app.get("/api/prompts", response_model=List[PromptOut])
def get_prompts(db: Session = Depends(get_db)):
    return db.query(Prompt).all()

@app.post("/api/prompts", response_model=PromptOut)
def create_prompt(prompt_data: PromptCreate, db: Session = Depends(get_db)):
    existing = db.query(Prompt).filter(Prompt.query_text == prompt_data.query_text).first()
    if existing:
        raise HTTPException(status_code=400, detail="Prompt query already exists")
    
    new_prompt = Prompt(
        query_text=prompt_data.query_text,
        category=prompt_data.category,
        frequency_hours=prompt_data.frequency_hours
    )
    db.add(new_prompt)
    db.commit()
    db.refresh(new_prompt)
    
    execute_tracking_runs_for_prompt(new_prompt.id, db)
    return new_prompt

@app.delete("/api/prompts/{id}")
def delete_prompt(id: int, db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    db.delete(prompt)
    db.commit()
    return {"message": "Prompt deleted successfully"}

@app.post("/api/prompts/{id}/run")
def run_prompt_now(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    prompt = db.query(Prompt).filter(Prompt.id == id).first()
    if not prompt:
        raise HTTPException(status_code=404, detail="Prompt not found")
    
    if os.environ.get("VERCEL"):
        # Serverless execution freezes after response; run synchronously to guarantee completion
        execute_tracking_runs_for_prompt(prompt.id, db)
        return {"message": f"Tracking job completed for prompt '{prompt.query_text}'"}
    else:
        background_tasks.add_task(execute_tracking_runs_for_prompt, prompt.id, db)
        return {"message": f"Tracking job launched for prompt '{prompt.query_text}'"}

# Settings APIs
@app.get("/api/settings")
def get_settings_endpoint(db: Session = Depends(get_db)):
    settings = get_global_settings(db)
    return {
        "brand_name": settings.brand_name,
        "target_domain": settings.target_domain,
        "serp_api_key": settings.serp_api_key or "",
        "competitors": settings.competitors or "globexcorp.com, initech.com, hooli.com"
    }

@app.post("/api/settings")
def update_settings_endpoint(payload: SettingUpdate, db: Session = Depends(get_db)):
    settings = get_global_settings(db)
    settings.brand_name = payload.brand_name
    settings.target_domain = payload.target_domain
    settings.serp_api_key = payload.serp_api_key or ""
    if payload.competitors is not None:
        settings.competitors = payload.competitors
    db.commit()
    return {
        "message": "Settings updated successfully", 
        "brand_name": settings.brand_name, 
        "target_domain": settings.target_domain,
        "serp_api_key": settings.serp_api_key,
        "competitors": settings.competitors
    }

@app.get("/api/dashboard-summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    prompts = db.query(Prompt).all()
    if not prompts:
        seed_database_if_empty(db)
        prompts = db.query(Prompt).all()

    logs = db.query(TrackingLog).all()
    citations = db.query(Citation).all()
    settings = get_global_settings(db)
    
    total_prompts = len(prompts)
    total_logs = len(logs)
    total_citations = len(citations)
    
    mentions_count = sum(1 for log in logs if log.brand_mentioned == 1)
    sov = round((mentions_count / total_logs * 100), 1) if total_logs > 0 else 0.0
    
    engines = ["Google AI Overview", "ChatGPT", "Perplexity"]
    engine_stats = {}
    for engine in engines:
        engine_logs = [l for l in logs if l.engine_name == engine]
        engine_total = len(engine_logs)
        engine_mentions = sum(1 for l in engine_logs if l.brand_mentioned == 1)
        engine_sov = round((engine_mentions / engine_total * 100), 1) if engine_total > 0 else 0.0
        
        sentiments = [l.sentiment for l in engine_logs if l.brand_mentioned == 1]
        positive_pct = round(sentiments.count("Positive") / len(sentiments) * 100, 1) if len(sentiments) > 0 else 0.0
        
        engine_stats[engine] = {
            "sov": engine_sov,
            "total_queries": engine_total,
            "positive_sentiment_pct": positive_pct
        }
        
    visibility_gap_index = round(100.0 - sov, 1)

    time_series_data = {}
    for log in logs:
        date_str = log.snapshot_date.strftime("%Y-%m-%d")
        if date_str not in time_series_data:
            time_series_data[date_str] = {"total": 0, "mentions": 0}
        time_series_data[date_str]["total"] += 1
        if log.brand_mentioned == 1:
            time_series_data[date_str]["mentions"] += 1
            
    sorted_dates = sorted(time_series_data.keys())
    time_series_list = []
    for d in sorted_dates:
        t = time_series_data[d]["total"]
        m = time_series_data[d]["mentions"]
        time_series_list.append({
            "date": d,
            "sov": round((m / t * 100), 1) if t > 0 else 0.0
        })

    # Dynamically extract and normalize competitor domain list
    competitor_list = [
        c.strip().lower().replace("http://", "").replace("https://", "").replace("www.", "").rstrip("/")
        for c in (settings.competitors or "").split(",")
        if c.strip()
    ]
    target_clean = settings.target_domain.lower().replace("www.", "").strip()

    citation_audit = []
    for cit in citations:
        cit_domain = cit.domain.lower().replace("www.", "").strip()
        is_brand = (cit_domain == target_clean)
        is_comp = any(comp in cit_domain or cit_domain in comp for comp in competitor_list) if not is_brand else False
        citation_audit.append({
            "id": cit.id,
            "url": cit.url,
            "domain": cit.domain,
            "rank": cit.structural_rank,
            "is_brand": is_brand,
            "is_competitor": is_comp
        })

    return {
        "metrics": {
            "total_prompts": total_prompts,
            "share_of_voice": sov,
            "total_citations": total_citations,
            "visibility_gap_index": visibility_gap_index
        },
        "engine_breakdown": engine_stats,
        "time_series": time_series_list,
        "citations": citation_audit,
        "target_brand": settings.brand_name,
        "target_domain": settings.target_domain,
        "target_competitors": competitor_list
    }

# Database Seeding Utility
def seed_database_if_empty(db: Session):
    settings = db.query(Setting).first()
    if not settings:
        settings = Setting(brand_name="AcmeCorp", target_domain="acmecorp.com")
        db.add(settings)
        db.commit()

    if db.query(Prompt).count() == 0:
        initial_prompts = [
            Prompt(query_text="Best automation orchestrator tool for devops", category="Commercial", frequency_hours=12),
            Prompt(query_text="How to set up agentic workflows with Antigravity", category="Informational", frequency_hours=24),
            Prompt(query_text="AcmeCorp system vs GlobexCorp database comparison", category="Brand Comparison", frequency_hours=24),
        ]
        for p in initial_prompts:
            db.add(p)
        db.commit()
        
        # Auto-generate 7 continuous days of historical log trends (35% to 60% SoV)
        engines = ["Google AI Overview", "ChatGPT", "Perplexity"]
        prompts = db.query(Prompt).all()
        today = datetime.datetime.utcnow()
        
        for day_offset in range(6, -1, -1):
            log_date = today - datetime.timedelta(days=day_offset)
            target_sov = 35 + (60 - 35) * (day_offset / 6.0) + random.uniform(-5, 5)
            target_sov = max(30, min(70, target_sov))
            
            for p in prompts:
                for engine in engines:
                    is_mentioned = 1 if random.random() * 100 < target_sov else 0
                    raw_desc = f"Engine extraction run log for '{p.query_text}'"
                    if is_mentioned:
                        raw_desc += f" featuring mentions for {settings.brand_name} ({settings.target_domain})."
                    else:
                        raw_desc += " referencing generic community responses."
                        
                    log = TrackingLog(
                        prompt_id=p.id,
                        engine_name=engine,
                        snapshot_date=log_date,
                        raw_response=raw_desc,
                        brand_mentioned=is_mentioned,
                        sentiment="Positive" if is_mentioned else "Neutral"
                    )
                    db.add(log)
                    db.commit()
                    db.refresh(log)
                    
                    if is_mentioned:
                        db.add(Citation(log_id=log.id, url=f"https://{settings.target_domain}/product", domain=settings.target_domain, structural_rank=1))
                        db.add(Citation(log_id=log.id, url="https://wikipedia.org/wiki/Automation", domain="wikipedia.org", structural_rank=2))
                    else:
                        db.add(Citation(log_id=log.id, url="https://globexcorp.com/info", domain="globexcorp.com", structural_rank=1))
                        db.add(Citation(log_id=log.id, url="https://hooli.com/cloud", domain="hooli.com", structural_rank=2))
                    db.commit()

# 7-day Historical Seeding on startup
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_database_if_empty(db)
    finally:
        db.close()

# Mount frontend dashboard (check public/ first, then fallback to frontend/)
frontend_dir = os.environ.get("FRONTEND_DIR")
if not frontend_dir:
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    public_path = os.path.join(base_dir, "public")
    frontend_path = os.path.join(base_dir, "frontend")
    frontend_dir = public_path if os.path.exists(public_path) else frontend_path

if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")


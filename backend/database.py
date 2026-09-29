import os
import shutil
import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL")

if DATABASE_URL:
    # Support postgres:// URL format used by Supabase/Neon/Heroku (SQLAlchemy requires postgresql://)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)
    engine = create_engine(DATABASE_URL, pool_pre_ping=True)
else:
    # Serverless runtime detection (Vercel / AWS Lambda): container filesystem is read-only except /tmp
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        db_path = "/tmp/geo_tracker.db"
        seed_db = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "geo_tracker.db"))
        if not os.path.exists(db_path) and os.path.exists(seed_db):
            try:
                shutil.copy2(seed_db, db_path)
            except Exception:
                pass
        DATABASE_URL = f"sqlite:///{db_path}"
    else:
        # Standard local development and desktop execution
        DATABASE_URL = "sqlite:///./geo_tracker.db"

    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Setting(Base):
    __tablename__ = "settings"
    id = Column(Integer, primary_key=True, index=True)
    brand_name = Column(String, default="AcmeCorp", nullable=False)
    target_domain = Column(String, default="acmecorp.com", nullable=False)
    serp_api_key = Column(String, default="", nullable=True)
    competitors = Column(String, default="globexcorp.com, initech.com, hooli.com", nullable=True)

class Prompt(Base):
    __tablename__ = "prompts"
    id = Column(Integer, primary_key=True, index=True)
    query_text = Column(String, unique=True, index=True, nullable=False)
    category = Column(String, nullable=False) # e.g., Informational, Commercial, Brand Comparison
    frequency_hours = Column(Integer, default=24)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    logs = relationship("TrackingLog", back_populates="prompt", cascade="all, delete-orphan")

class TrackingLog(Base):
    __tablename__ = "tracking_logs"
    id = Column(Integer, primary_key=True, index=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    engine_name = Column(String, nullable=False) # e.g., Google AI Overview, ChatGPT, Perplexity
    snapshot_date = Column(DateTime, default=datetime.datetime.utcnow)
    raw_response = Column(Text, nullable=False)
    brand_mentioned = Column(Integer, default=0) # 0 = No, 1 = Yes
    sentiment = Column(String, default="Neutral") # Positive, Neutral, Negative

    prompt = relationship("Prompt", back_populates="logs")
    citations = relationship("Citation", back_populates="log", cascade="all, delete-orphan")

class Citation(Base):
    __tablename__ = "citations"
    id = Column(Integer, primary_key=True, index=True)
    log_id = Column(Integer, ForeignKey("tracking_logs.id", ondelete="CASCADE"), nullable=False)
    url = Column(String, nullable=False)
    domain = Column(String, nullable=False)
    structural_rank = Column(Integer, nullable=False) # 1, 2, 3, etc.

    log = relationship("TrackingLog", back_populates="citations")

def init_db():
    Base.metadata.create_all(bind=engine)
    # Ensure competitors column exists in existing database
    try:
        from sqlalchemy import text
        with engine.connect() as conn:
            conn.execute(text("ALTER TABLE settings ADD COLUMN competitors VARCHAR DEFAULT 'globexcorp.com, initech.com, hooli.com'"))
            conn.commit()
    except Exception:
        pass


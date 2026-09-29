# GEO Tracking Background Scheduler

This skill sets up a cron job or scheduled execution process to trigger answer engine scans periodically.

## Usage
Simply run the cron executor by scheduling or triggering the tracking script via Python.

```powershell
# Command prefix to manually execute scheduled sync job for all registered prompts:
python -c "from database import SessionLocal, Prompt; from main import execute_tracking_runs_for_prompt; db=SessionLocal(); [execute_tracking_runs_for_prompt(p.id, db) for p in db.query(Prompt).all()]; db.close(); print('Successfully ran routine GEO tracking update!')"
```

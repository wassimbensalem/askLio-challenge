# backend/main.py
from backend.database import engine
from backend import models
from backend.routes import requests, extract, agent
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

models.Base.metadata.create_all(bind=engine)

# Additive migrations for columns added after initial deployment
with engine.connect() as _conn:
    for _stmt in [
        "ALTER TABLE requests ADD COLUMN note TEXT",
        "ALTER TABLE requests ADD COLUMN intake_method TEXT",
        "ALTER TABLE requests ADD COLUMN agent_recommendation TEXT",
        "ALTER TABLE requests ADD COLUMN agent_note TEXT",
        "ALTER TABLE requests ADD COLUMN agent_ran_at DATETIME",
    ]:
        try:
            _conn.execute(text(_stmt))
            _conn.commit()
        except Exception:
            pass  # column already exists

app = FastAPI(title="Procurement Intake API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(requests.router)
app.include_router(extract.router)
app.include_router(agent.router)


@app.get("/health")
def health():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {"status": "ok", "db": "ok"}
    except Exception as e:
        return {"status": "degraded", "db": str(e)}

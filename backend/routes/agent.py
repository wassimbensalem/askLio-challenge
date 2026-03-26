# backend/routes/agent.py
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Request
from backend.services.agent import run_agent

router = APIRouter(prefix="/requests", tags=["agent"])


@router.post("/{request_id}/agent")
async def trigger_agent(request_id: int, db: Session = Depends(get_db)):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")

    return StreamingResponse(
        run_agent(request_id, db),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )

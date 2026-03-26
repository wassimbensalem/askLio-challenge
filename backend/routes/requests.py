# backend/routes/requests.py
from datetime import datetime, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.database import get_db
from backend.models import Comment, OrderLine, Request, StatusHistory
from backend.schemas import CommentCreate, CommentResponse, NoteUpdate, RequestCreate, RequestResponse, RequestUpdate, StatusUpdate

router = APIRouter(prefix="/requests", tags=["requests"])


@router.post("", response_model=RequestResponse)
def create_request(request_data: RequestCreate, db: Session = Depends(get_db)):
    expected_total = round(sum(line.total_price for line in request_data.order_lines), 2)
    if abs(expected_total - round(request_data.total_cost, 2)) > 0.02:
        raise HTTPException(
            status_code=422,
            detail=f"total_cost {request_data.total_cost:.2f} does not match sum of order lines {expected_total:.2f}",
        )
    db_request = Request(
        requestor_name=request_data.requestor_name,
        title=request_data.title,
        vendor_name=request_data.vendor_name,
        vat_id=request_data.vat_id,
        department=request_data.department,
        commodity_group_id=request_data.commodity_group_id,
        commodity_group_name=request_data.commodity_group_name,
        total_cost=request_data.total_cost,
        intake_method=request_data.intake_method,
        status="Open",
    )
    db.add(db_request)
    db.flush()

    for line in request_data.order_lines:
        db.add(
            OrderLine(
                request_id=db_request.id,
                description=line.description,
                unit_price=line.unit_price,
                quantity=line.quantity,
                unit=line.unit,
                total_price=line.total_price,
            )
        )

    db.commit()
    db.refresh(db_request)
    return db_request


@router.get("", response_model=List[RequestResponse])
def get_requests(db: Session = Depends(get_db)):
    return db.query(Request).order_by(Request.created_at.desc()).all()


@router.delete("/{request_id}", status_code=204)
def delete_request(request_id: int, db: Session = Depends(get_db)):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")
    db.delete(db_request)
    db.commit()


@router.patch("/{request_id}", response_model=RequestResponse)
def update_request(request_id: int, update: RequestUpdate, db: Session = Depends(get_db)):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")

    if update.title is not None:
        db_request.title = update.title
    if update.vendor_name is not None:
        db_request.vendor_name = update.vendor_name
    if update.vat_id is not None:
        db_request.vat_id = update.vat_id
    if update.commodity_group_id is not None:
        db_request.commodity_group_id = update.commodity_group_id
    if update.commodity_group_name is not None:
        db_request.commodity_group_name = update.commodity_group_name

    if update.order_lines is not None:
        db.query(OrderLine).filter(OrderLine.request_id == request_id).delete()
        for line in update.order_lines:
            db.add(OrderLine(
                request_id=request_id,
                description=line.description,
                unit_price=line.unit_price,
                quantity=line.quantity,
                unit=line.unit,
                total_price=line.total_price,
            ))
        db_request.total_cost = round(sum(l.total_price for l in update.order_lines), 2)

    db.commit()
    db.refresh(db_request)
    return db_request


@router.post("/{request_id}/comments", response_model=CommentResponse)
def add_comment(request_id: int, comment: CommentCreate, db: Session = Depends(get_db)):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")
    db_comment = Comment(request_id=request_id, author=comment.author, text=comment.text)
    db.add(db_comment)
    db.commit()
    db.refresh(db_comment)
    return db_comment


@router.patch("/{request_id}/note", response_model=RequestResponse)
def update_note(request_id: int, note_update: NoteUpdate, db: Session = Depends(get_db)):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")
    db_request.note = note_update.note.strip() or None
    db.commit()
    db.refresh(db_request)
    return db_request


@router.patch("/{request_id}/status", response_model=RequestResponse)
def update_status(
    request_id: int, status_update: StatusUpdate, db: Session = Depends(get_db)
):
    db_request = db.query(Request).filter(Request.id == request_id).first()
    if not db_request:
        raise HTTPException(status_code=404, detail="Request not found")

    db.add(
        StatusHistory(
            request_id=request_id,
            old_status=db_request.status,
            new_status=status_update.status,
            changed_at=datetime.now(timezone.utc),
        )
    )
    db_request.status = status_update.status
    db.commit()
    db.refresh(db_request)
    return db_request

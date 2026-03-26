# backend/schemas.py
import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, field_validator


class OrderLineCreate(BaseModel):
    description: str
    unit_price: float
    quantity: float
    unit: str
    total_price: float


class RequestCreate(BaseModel):
    requestor_name: str
    title: str
    vendor_name: str
    vat_id: str
    department: str
    commodity_group_id: str
    commodity_group_name: str
    total_cost: float
    intake_method: Optional[str] = None
    order_lines: List[OrderLineCreate]

    @field_validator("vat_id")
    @classmethod
    def validate_vat_id(cls, v: str) -> str:
        if not re.match(r"^DE\d{9}$", v):
            raise ValueError(
                "VAT ID must be in format DE followed by 9 digits (e.g. DE123456789)"
            )
        return v


class OrderLineResponse(BaseModel):
    id: int
    description: str
    unit_price: float
    quantity: float
    unit: str
    total_price: float

    model_config = {"from_attributes": True}


class StatusHistoryResponse(BaseModel):
    id: int
    old_status: str
    new_status: str
    changed_at: datetime

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: int
    author: str
    text: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RequestResponse(BaseModel):
    id: int
    requestor_name: str
    title: str
    vendor_name: str
    vat_id: str
    department: str
    commodity_group_id: str
    commodity_group_name: str
    total_cost: float
    status: str
    note: Optional[str] = None
    intake_method: Optional[str] = None
    created_at: datetime
    order_lines: List[OrderLineResponse]
    status_history: List[StatusHistoryResponse]
    comments: List[CommentResponse] = []
    agent_recommendation: Optional[str] = None
    agent_note: Optional[str] = None
    agent_ran_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class NoteUpdate(BaseModel):
    note: str


class CommentCreate(BaseModel):
    author: str
    text: str


class RequestUpdate(BaseModel):
    title: Optional[str] = None
    vendor_name: Optional[str] = None
    vat_id: Optional[str] = None
    commodity_group_id: Optional[str] = None
    commodity_group_name: Optional[str] = None
    order_lines: Optional[List[OrderLineCreate]] = None

    @field_validator("vat_id", mode="before")
    @classmethod
    def validate_vat_id_optional(cls, v: str) -> str:
        if v is not None and not re.match(r"^DE\d{9}$", v):
            raise ValueError("VAT ID must be in format DE followed by 9 digits")
        return v


class StatusUpdate(BaseModel):
    status: str

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = ["Open", "In Progress", "Closed"]
        if v not in allowed:
            raise ValueError("Status must be one of: Open, In Progress, Closed")
        return v


class ExtractionResponse(BaseModel):
    title: Optional[str] = None
    vendor_name: Optional[str] = None
    vat_id: Optional[str] = None
    department: Optional[str] = None
    order_lines: List[OrderLineCreate] = []
    total_cost: Optional[float] = None
    commodity_group_id: Optional[str] = None
    commodity_group_name: Optional[str] = None

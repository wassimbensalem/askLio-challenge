# backend/models.py
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from backend.database import Base


class Request(Base):
    __tablename__ = "requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    requestor_name = Column(String, nullable=False)
    title = Column(String, nullable=False)
    vendor_name = Column(String, nullable=False)
    vat_id = Column(String, nullable=False)
    department = Column(String, nullable=False)
    commodity_group_id = Column(String, nullable=False)
    commodity_group_name = Column(String, nullable=False)
    total_cost = Column(Float, nullable=False)
    status = Column(String, default="Open", nullable=False)
    note = Column(String, nullable=True)
    intake_method = Column(String, nullable=True)  # 'pdf' | 'nl' | 'manual'
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    note = Column(String, nullable=True)
    agent_recommendation = Column(String, nullable=True)   # 'approve' | 'review' | 'reject'
    agent_note = Column(String, nullable=True)
    agent_ran_at = Column(DateTime, nullable=True)

    order_lines = relationship(
        "OrderLine", back_populates="request", cascade="all, delete-orphan"
    )
    status_history = relationship(
        "StatusHistory",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="StatusHistory.changed_at",
    )
    comments = relationship(
        "Comment",
        back_populates="request",
        cascade="all, delete-orphan",
        order_by="Comment.created_at",
    )


class OrderLine(Base):
    __tablename__ = "order_lines"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    description = Column(String, nullable=False)
    unit_price = Column(Float, nullable=False)
    quantity = Column(Float, nullable=False)
    unit = Column(String, nullable=False)
    total_price = Column(Float, nullable=False)

    request = relationship("Request", back_populates="order_lines")


class StatusHistory(Base):
    __tablename__ = "status_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    old_status = Column(String, nullable=False)
    new_status = Column(String, nullable=False)
    changed_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    request = relationship("Request", back_populates="status_history")


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(Integer, ForeignKey("requests.id"), nullable=False)
    author = Column(String, nullable=False)
    text = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    request = relationship("Request", back_populates="comments")

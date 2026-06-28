from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, JSON
from app.core.database import Base

class OutboxEvent(Base):
    __tablename__ = "outbox_events"

    id = Column(Integer, primary_key=True, index=True)
    resource_type = Column(String(50), nullable=False) # e.g., 'Patient', 'Appointment'
    resource_id = Column(String(100), nullable=False) # Local ID of the resource
    action = Column(String(20), nullable=False) # 'create', 'update', 'delete'
    payload_fhir = Column(JSON, nullable=False) # FHIR representation
    status = Column(String(20), nullable=False, default="pending") # pending, processed, error
    error_message = Column(Text, nullable=True)
    attempts = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    processed_at = Column(DateTime, nullable=True)

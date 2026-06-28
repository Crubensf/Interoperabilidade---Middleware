import asyncio
import httpx
import json
import logging
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime

from app.core.database import SessionLocal
from app.modelos.outbox import OutboxEvent
from app.core.environment import settings

logger = logging.getLogger(__name__)

async def process_outbox_events():
    """Polls the outbox table and sends events to the Middleware."""
    if not settings.MIDDLEWARE_BASE_URL:
        logger.warning("MIDDLEWARE_BASE_URL não está configurada. Outbox pausada.")
        return

    base_url = settings.MIDDLEWARE_BASE_URL.rstrip("/")
    headers = {
        "Content-Type": "application/fhir+json",
        "X-Source-System": "sistema_b",
    }
    if settings.MIDDLEWARE_API_KEY:
        headers["X-API-Key"] = settings.MIDDLEWARE_API_KEY

    with SessionLocal() as db:
        events = db.execute(
            select(OutboxEvent)
            .where(OutboxEvent.status == "pending")
            .order_by(OutboxEvent.created_at.asc())
            .limit(50)
        ).scalars().all()

        if not events:
            return

        async with httpx.AsyncClient(timeout=10.0) as client:
            for event in events:
                event.attempts += 1
                try:
                    endpoint = f"/fhir/{event.resource_type}"
                    # X-Event-Id e Idempotency-Key
                    event_headers = dict(headers)
                    event_headers["X-Event-Id"] = f"evt_{event.id}_{event.attempts}"
                    event_headers["Idempotency-Key"] = f"idemp_{event.id}"

                    response = await client.post(
                        f"{base_url}{endpoint}",
                        json=event.payload_fhir,
                        headers=event_headers
                    )
                    
                    if response.status_code in (200, 201):
                        event.status = "processed"
                        event.processed_at = datetime.utcnow()
                    else:
                        event.error_message = f"HTTP {response.status_code}: {response.text}"
                        if event.attempts >= 5:
                            event.status = "error"
                except Exception as e:
                    event.error_message = str(e)
                    if event.attempts >= 5:
                        event.status = "error"
                
                db.commit()


async def outbox_loop():
    """Loop contínuo que roda em background."""
    while True:
        try:
            await process_outbox_events()
        except Exception as e:
            logger.error(f"Erro no loop do outbox: {e}")
        await asyncio.sleep(5)

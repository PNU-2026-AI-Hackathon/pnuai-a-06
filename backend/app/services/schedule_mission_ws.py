import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket

from app.services.localization import localized_session


class ScheduleMissionConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, dict[WebSocket, str]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect(self, schedule_id: int, websocket: WebSocket, locale: str = "ko") -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[schedule_id][websocket] = locale

    async def disconnect(self, schedule_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(schedule_id)
            if not connections:
                return
            connections.pop(websocket, None)
            if not connections:
                self._connections.pop(schedule_id, None)

    async def broadcast_session(
        self, schedule_id: int, session, event_type: str
    ) -> None:
        async with self._lock:
            connections = list(self._connections.get(schedule_id, {}).items())
        stale_connections: list[WebSocket] = []
        responses: dict[str, dict] = {}
        for websocket, locale in connections:
            try:
                payload = responses.setdefault(
                    locale,
                    localized_session(session, locale).model_dump(mode="json"),
                )
                event = {
                    "type": event_type,
                    "scheduleId": schedule_id,
                    "sessionId": session.id,
                    "serverTime": datetime.now(timezone.utc).isoformat(),
                    "payload": {"session": payload},
                }
                await websocket.send_json(event)
            except Exception:
                stale_connections.append(websocket)
        for websocket in stale_connections:
            await self.disconnect(schedule_id, websocket)

    async def send_snapshot(
        self, websocket: WebSocket, schedule_id: int, session, locale: str = "ko"
    ) -> None:
        payload = (
            localized_session(session, locale).model_dump(mode="json")
            if session is not None
            else None
        )
        await websocket.send_json(
            {
                "type": "schedule_mission_snapshot",
                "scheduleId": schedule_id,
                "sessionId": session.id if session is not None else None,
                "serverTime": datetime.now(timezone.utc).isoformat(),
                "payload": {"session": payload},
            }
        )


manager = ScheduleMissionConnectionManager()

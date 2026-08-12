import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket

from app.schemas.mission_sessions import MissionSessionResponse


class ScheduleMissionConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, schedule_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[schedule_id].add(websocket)

    async def disconnect(self, schedule_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(schedule_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(schedule_id, None)

    async def broadcast_session(
        self, schedule_id: int, session, event_type: str
    ) -> None:
        response = MissionSessionResponse.model_validate(session)
        event = {
            "type": event_type,
            "scheduleId": schedule_id,
            "sessionId": session.id,
            "serverTime": datetime.now(timezone.utc).isoformat(),
            "payload": {"session": response.model_dump(mode="json")},
        }
        async with self._lock:
            connections = list(self._connections.get(schedule_id, ()))
        stale_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except Exception:
                stale_connections.append(websocket)
        for websocket in stale_connections:
            await self.disconnect(schedule_id, websocket)

    async def send_snapshot(self, websocket: WebSocket, schedule_id: int, session) -> None:
        payload = (
            MissionSessionResponse.model_validate(session).model_dump(mode="json")
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

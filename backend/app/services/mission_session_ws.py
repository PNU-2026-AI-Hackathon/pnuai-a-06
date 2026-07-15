import asyncio
from collections import defaultdict
from datetime import datetime, timezone

from fastapi import WebSocket

from app.schemas.mission_sessions import MissionSessionResponse


class MissionSessionConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[int, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def connect(self, session_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        async with self._lock:
            self._connections[session_id].add(websocket)

    async def disconnect(self, session_id: int, websocket: WebSocket) -> None:
        async with self._lock:
            connections = self._connections.get(session_id)
            if not connections:
                return
            connections.discard(websocket)
            if not connections:
                self._connections.pop(session_id, None)

    async def broadcast(self, session_id: int, event_type: str, payload: dict) -> None:
        event = {
            "type": event_type,
            "sessionId": session_id,
            "serverTime": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        }
        async with self._lock:
            connections = list(self._connections.get(session_id, ()))
        stale_connections: list[WebSocket] = []
        for websocket in connections:
            try:
                await websocket.send_json(event)
            except Exception:
                stale_connections.append(websocket)
        for websocket in stale_connections:
            await self.disconnect(session_id, websocket)

    async def broadcast_session(self, session, event_type: str = "session_updated") -> None:
        response = MissionSessionResponse.model_validate(session)
        await self.broadcast(
            session.id,
            event_type,
            {"session": response.model_dump(mode="json")},
        )

    async def send_session(self, websocket: WebSocket, session, event_type: str = "session_snapshot") -> None:
        response = MissionSessionResponse.model_validate(session)
        await websocket.send_json(
            {
                "type": event_type,
                "sessionId": session.id,
                "serverTime": datetime.now(timezone.utc).isoformat(),
                "payload": {"session": response.model_dump(mode="json")},
            }
        )


manager = MissionSessionConnectionManager()

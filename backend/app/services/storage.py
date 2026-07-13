from pathlib import Path

from fastapi import UploadFile


class LocalStorageService:
    """Local MVP storage. The interface can later be replaced with S3 storage."""

    def __init__(self, root: str = "app/static"):
        self.root = Path(root)

    async def save(self, file: UploadFile, key: str) -> str:
        destination = self.root / key
        destination.parent.mkdir(parents=True, exist_ok=True)
        with destination.open("wb") as output:
            while chunk := await file.read(1024 * 1024):
                output.write(chunk)
        return f"/static/{key}"

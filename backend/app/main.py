from fastapi import FastAPI

app = FastAPI(
    title="Jjigeukka API",
    description="Basic FastAPI backend for the Jjigeukka project.",
    version="0.1.0",
)


@app.get("/")
def read_root():
    return {"message": "Jjigeukka API is running"}


@app.get("/health")
def health_check():
    return {"status": "ok"}

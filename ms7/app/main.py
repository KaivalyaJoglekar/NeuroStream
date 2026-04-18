from fastapi import FastAPI
from app.router import router
from app.config import settings

app = FastAPI(
    title="NeuroStream MS7 — PDF Export",
    description="Converts MS6 AI outputs into downloadable PDFs stored in S3.",
    version="1.0.0",
)

app.include_router(router)


@app.get("/health")
def health():
    return {
        "service": "neurostream-ms7",
        "status": "ok",
        "bucket": settings.s3_export_bucket,
    }

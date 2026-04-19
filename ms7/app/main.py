import threading
import uvicorn
from fastapi import FastAPI
from app.router import router
from app.config import settings
from app.rabbitmq_consumer import start_consumer

app = FastAPI(
    title="NeuroStream MS7 — PDF Export",
    description="Converts MS6 AI outputs into downloadable PDFs stored in S3.",
    version="1.0.0",
)

app.include_router(router)

# Optional RMQ consumer (kept disabled by default for minimal deployments)
if settings.enable_rabbitmq_consumer:
    threading.Thread(target=start_consumer, daemon=True).start()


@app.get("/health")
def health():
    return {
        "service": "neurostream-ms7",
        "status": "ok",
        "bucket": settings.s3_export_bucket,
    }

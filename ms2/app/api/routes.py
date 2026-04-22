from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request

from app.models.schemas import HealthResponse, JobStatusResponse, ProcessRequest, ProcessResponse
from app.services.pipeline import ProcessingService
from app.workers.celery_worker import process_media_job


router = APIRouter()


def get_processing_service(request: Request) -> ProcessingService:
    return request.app.state.processing_service


@router.get("/health", response_model=HealthResponse)
async def health(request: Request) -> HealthResponse:
    settings = request.app.state.settings
    execution_mode = "inline" if request.app.state.settings.process_inline else "celery"
    using_real_providers = not settings.mock_external_services
    return HealthResponse(
        service=settings.service_name,
        execution_mode=execution_mode,
        mock_external_services=settings.mock_external_services,
        transcription_backend="openai_whisper_api" if using_real_providers and settings.openai_api_key else "mock_fallback",
        vision_backend="gemini_vision" if using_real_providers and settings.gemini_api_key and settings.gemini_vision_model else "mock_fallback",
        embedding_backend="gemini_embeddings" if using_real_providers and settings.gemini_api_key else "deterministic_fallback",
    )


@router.post("/process", response_model=ProcessResponse)
async def process_media(
    payload: ProcessRequest,
    request: Request,
    processing_service: Annotated[ProcessingService, Depends(get_processing_service)],
) -> ProcessResponse:
    request.app.state.job_tracker.update(
        payload.job_id,
        video_id=payload.video_id,
        status="queued",
        detail="Job accepted",
    )

    if request.app.state.settings.process_inline:
        try:
            return await processing_service.process(payload)
        except Exception as exc:
            request.app.state.job_tracker.update(
                payload.job_id,
                video_id=payload.video_id,
                status="failed",
                detail="Inline processing failed",
                error=str(exc),
            )
            raise HTTPException(status_code=500, detail=str(exc)) from exc

    task = process_media_job.delay(payload.model_dump(mode="json"))
    request.app.state.job_tracker.update(
        payload.job_id,
        video_id=payload.video_id,
        status="queued",
        detail=f"Queued for Celery worker ({task.id})",
    )
    return ProcessResponse(
        job_id=payload.job_id,
        video_id=payload.video_id,
        status="queued",
        chunks_generated=0,
        ms3_notified=False,
        ms4_notified=False,
        queued=True,
    )


@router.get("/status/{job_id}", response_model=JobStatusResponse)
async def get_status(job_id: str, request: Request) -> JobStatusResponse:
    payload = request.app.state.job_tracker.get(job_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="job not found")
    return payload

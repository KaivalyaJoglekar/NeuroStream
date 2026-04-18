from fastapi import APIRouter, HTTPException
from app.schemas import (
    ChatExportRequest, SummarizeExportRequest, ResearchExportRequest,
    ExportResponse,
)
from app.pdf_service import build_chat_pdf, build_summarize_pdf, build_research_pdf
from app.s3_service import upload_pdf
from app.config import settings

router = APIRouter(prefix="/api/v1/export", tags=["export"])


@router.post("/chat", response_model=ExportResponse)
def export_chat(req: ChatExportRequest):
    """Export a MS6 /chat or /search-chat response as a PDF."""
    try:
        pdf = build_chat_pdf(req)
        url, key = upload_pdf(pdf, "chat")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ExportResponse(
        download_url=url,
        s3_key=key,
        expires_in_seconds=settings.presigned_url_expiry,
    )


@router.post("/summarize", response_model=ExportResponse)
def export_summarize(req: SummarizeExportRequest):
    """Export a MS6 /summarize response as a PDF."""
    try:
        pdf = build_summarize_pdf(req)
        url, key = upload_pdf(pdf, "summary")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ExportResponse(
        download_url=url,
        s3_key=key,
        expires_in_seconds=settings.presigned_url_expiry,
    )


@router.post("/research", response_model=ExportResponse)
def export_research(req: ResearchExportRequest):
    """Export a MS6 /research response as a PDF."""
    try:
        pdf = build_research_pdf(req)
        url, key = upload_pdf(pdf, "research")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    return ExportResponse(
        download_url=url,
        s3_key=key,
        expires_in_seconds=settings.presigned_url_expiry,
    )

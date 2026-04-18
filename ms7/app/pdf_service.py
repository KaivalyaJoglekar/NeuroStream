from fpdf import FPDF
from app.schemas import ChatExportRequest, SummarizeExportRequest, ResearchExportRequest


# ── Shared helpers ────────────────────────────────────────────────────────────

def _base_pdf(title: str) -> FPDF:
    """Create a styled FPDF instance with header/footer."""
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 20)
    pdf.cell(0, 12, "NeuroStream", ln=True)
    pdf.set_font("Helvetica", "", 13)
    pdf.set_text_color(80, 80, 80)
    pdf.cell(0, 8, title, ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)
    pdf.set_draw_color(200, 200, 200)
    pdf.line(10, pdf.get_y(), 200, pdf.get_y())
    pdf.ln(6)
    return pdf


def _section(pdf: FPDF, heading: str) -> None:
    pdf.set_font("Helvetica", "B", 12)
    pdf.set_fill_color(240, 240, 240)
    pdf.cell(0, 8, heading, ln=True, fill=True)
    pdf.set_font("Helvetica", "", 10)
    pdf.ln(2)


def _body(pdf: FPDF, text: str) -> None:
    """Write multi-line body text safely (strips non-latin chars)."""
    safe = text.encode("latin-1", errors="replace").decode("latin-1")
    pdf.multi_cell(0, 6, safe)
    pdf.ln(3)


def _fmt_ts(seconds: float) -> str:
    m, s = divmod(int(seconds), 60)
    return f"{m:02d}:{s:02d}"


# ── PDF builders ──────────────────────────────────────────────────────────────

def build_chat_pdf(req: ChatExportRequest) -> bytes:
    pdf = _base_pdf(req.title)

    _section(pdf, "Question")
    _body(pdf, req.question)

    _section(pdf, "Answer")
    _body(pdf, req.answer)

    if req.citations:
        _section(pdf, "Citations")
        for c in req.citations:
            line = f"[{_fmt_ts(c.start_time)}-{_fmt_ts(c.end_time)}] ({c.source}) {c.text}"
            _body(pdf, line)

    return bytes(pdf.output())


def build_summarize_pdf(req: SummarizeExportRequest) -> bytes:
    pdf = _base_pdf(req.title)

    _section(pdf, f"Video: {req.video_id}")
    _section(pdf, "Summary")
    _body(pdf, req.summary)

    if req.chapters:
        _section(pdf, "Chapters")
        for ch in req.chapters:
            pdf.set_font("Helvetica", "B", 10)
            ts = f"[{_fmt_ts(ch.start_time)}-{_fmt_ts(ch.end_time)}] {ch.title}"
            pdf.cell(0, 7, ts, ln=True)
            pdf.set_font("Helvetica", "", 10)
            _body(pdf, ch.summary)

    return bytes(pdf.output())


def build_research_pdf(req: ResearchExportRequest) -> bytes:
    pdf = _base_pdf(req.title)

    pdf.set_font("Helvetica", "", 10)
    pdf.set_text_color(100, 100, 100)
    meta = f"Topic: {req.topic}  |  Sources: {req.sources_used}  |  Videos analyzed: {req.videos_analyzed}"
    pdf.cell(0, 7, meta, ln=True)
    pdf.set_text_color(0, 0, 0)
    pdf.ln(4)

    _section(pdf, "Research Report")
    _body(pdf, req.report)

    return bytes(pdf.output())

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Sequence

from app.core.config import Settings
from app.models.schemas import AudioSegmentInput, TranscriptSegment
from app.services.s3_helper import download_s3_file


logger = logging.getLogger(__name__)


class TranscriptionService:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    async def transcribe(self, audio_segments: Sequence[AudioSegmentInput]) -> list[TranscriptSegment]:
        if not audio_segments:
            return []

        if not self._settings.mock_external_services and self._settings.openai_api_key:
            try:
                return await asyncio.to_thread(self._transcribe_with_openai_api, audio_segments)
            except Exception as exc:
                logger.warning("OpenAI Whisper API failed, falling back to mock output: %s", exc)

        return self._fallback_transcription(audio_segments)

    def _transcribe_with_openai_api(
        self,
        audio_segments: Sequence[AudioSegmentInput],
    ) -> list[TranscriptSegment]:
        """Transcribe audio using the OpenAI Whisper API (cloud, no local model)."""
        from openai import OpenAI

        client = OpenAI(api_key=self._settings.openai_api_key)
        transcripts: list[TranscriptSegment] = []
        downloaded_files: list[str] = []

        try:
            for index, audio_segment in enumerate(audio_segments):
                # Resolve file: download from S3 if not a local path
                media_path = Path(audio_segment.s3_key)
                if media_path.exists():
                    local_path = str(media_path)
                else:
                    local_path = download_s3_file(self._settings, audio_segment.s3_key)
                    downloaded_files.append(local_path)

                start_offset = audio_segment.start_time if audio_segment.start_time is not None else 0.0

                logger.info(
                    "Transcribing segment %d/%d via OpenAI API: %s",
                    index + 1, len(audio_segments), audio_segment.s3_key,
                )

                # Call OpenAI Whisper API with verbose JSON for timestamps
                with open(local_path, "rb") as audio_file:
                    response = client.audio.transcriptions.create(
                        model="whisper-1",
                        file=audio_file,
                        response_format="verbose_json",
                        timestamp_granularities=["segment"],
                    )

                # Parse segments from the response
                segments = getattr(response, "segments", None) or []

                if segments:
                    for segment in segments:
                        seg_start = start_offset + float(getattr(segment, "start", 0.0))
                        seg_end = start_offset + float(getattr(segment, "end", seg_start))
                        seg_text = getattr(segment, "text", "").strip()

                        if not seg_text:
                            continue

                        transcripts.append(
                            TranscriptSegment(
                                start_time=seg_start,
                                end_time=seg_end,
                                text=seg_text,
                                source_key=audio_segment.s3_key,
                            )
                        )
                else:
                    # No segments returned — use the full text as one block
                    full_text = getattr(response, "text", "").strip()
                    if full_text:
                        end_time = audio_segment.end_time if audio_segment.end_time is not None else start_offset + 15.0
                        transcripts.append(
                            TranscriptSegment(
                                start_time=start_offset,
                                end_time=end_time,
                                text=full_text,
                                source_key=audio_segment.s3_key,
                            )
                        )

        finally:
            # Clean up downloaded temp files
            for path in downloaded_files:
                try:
                    os.remove(path)
                except OSError:
                    pass

        logger.info("OpenAI API transcription complete: %d segments", len(transcripts))
        return transcripts

    def _fallback_transcription(
        self,
        audio_segments: Sequence[AudioSegmentInput],
    ) -> list[TranscriptSegment]:
        transcripts: list[TranscriptSegment] = []
        cursor = 0.0
        for index, audio_segment in enumerate(audio_segments):
            start_time = audio_segment.start_time if audio_segment.start_time is not None else cursor
            end_time = audio_segment.end_time if audio_segment.end_time is not None else start_time + 15.0
            stem = Path(audio_segment.s3_key).stem.replace("_", " ").replace("-", " ")
            text = f"Transcribed narration from {stem or f'audio segment {index + 1}'}."
            transcripts.append(
                TranscriptSegment(
                    start_time=start_time,
                    end_time=end_time,
                    text=text,
                    source_key=audio_segment.s3_key,
                )
            )
            cursor = end_time
        return transcripts

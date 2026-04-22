import {
  API_BASE_URL,
  MS1_BASE_URL,
  MS2_BASE_URL,
  MS3_BASE_URL,
  MS5_BASE_URL,
  MS6_BASE_URL,
  MS7_BASE_URL,
} from '../lib/constants';
import { getStoredToken, getStoredUser } from '../lib/storage';
import { ApiResponse } from '../types/api';

export type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type SearchResult = {
  id: string;
  timestampSec: number;
  text: string;
  score: number;
};

export type Citation = {
  videoId?: string;
  startTime: number;
  endTime: number;
  text: string;
  source: string;
};

export type TranscriptSegment = {
  id: string;
  startSec: number;
  endSec: number;
  text: string;
};

export type SummaryChapter = {
  title: string;
  startSec: number;
  endSec: number;
  summary: string;
};

export type SummaryResult = {
  videoId: string;
  summary: string;
  chapters: SummaryChapter[];
};

export type ResearchResult = {
  report: string;
  sourcesUsed: number;
  videosAnalyzed: number;
  iterationsTaken: number;
};

export type ExportResult = {
  downloadUrl: string;
  s3Key: string;
  expiresInSeconds: number;
};

export type ServiceHealth = {
  key: 'ms1' | 'ms2' | 'ms3' | 'ms4' | 'ms5' | 'ms6' | 'ms7';
  label: string;
  ok: boolean;
  baseUrl: string;
  statusCode?: number;
  payload?: unknown;
  error?: string;
};

type Ms6Citation = {
  video_id?: string;
  start_time: number;
  end_time: number;
  text: string;
  source: string;
};

type Ms6ChatResponse = {
  answer: string;
  citations: Ms6Citation[];
};

type Ms6SummarizeResponse = {
  video_id: string;
  summary: string;
  chapters: Array<{
    title: string;
    start_time: number;
    end_time: number;
    summary: string;
  }>;
};

type Ms6ResearchResponse = {
  report: string;
  sources_used: number;
  videos_analyzed: number;
  iterations_taken: number;
};

type Ms7ExportResponse = {
  download_url: string;
  s3_key: string;
  expires_in_seconds: number;
};

type Ms3SearchResponse = {
  results: Array<{
    video_id: string;
    chunk_id: number;
    start_time: number;
    end_time: number;
    text: string;
    source: string;
    score: number;
  }>;
};

type Ms3ChunkResponse = Array<{
  id: number;
  start_time: number;
  end_time: number;
  text: string;
}>;

type Ms3VideoStatusResponse = {
  video_id: string;
  status: string;
  indexed_at?: string | null;
};

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/+$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function withQuery(url: string, params: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && `${value}`.length > 0) {
      query.set(key, String(value));
    }
  });
  const queryString = query.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function getErrorMessage(payload: unknown, statusText: string): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload;
  }
  if (payload && typeof payload === 'object') {
    const maybePayload = payload as { detail?: unknown; error?: unknown; message?: unknown };
    if (typeof maybePayload.detail === 'string') {
      return maybePayload.detail;
    }
    if (typeof maybePayload.error === 'string') {
      return maybePayload.error;
    }
    if (typeof maybePayload.message === 'string') {
      return maybePayload.message;
    }
  }
  return statusText || 'Request failed';
}

async function microserviceRequest<T>(url: string, options: RequestInit = {}, timeoutMs = 45000): Promise<ApiResponse<T>> {
  const headers = new Headers(options.headers);
  const token = getStoredToken();

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    clearTimeout(timeout);

    const contentType = response.headers.get('content-type') ?? '';
    const payload = contentType.includes('application/json') ? (await response.json()) : null;

    if (!response.ok) {
      return {
        success: false,
        error: getErrorMessage(payload, response.statusText),
      };
    }

    if (payload && typeof payload === 'object' && 'success' in payload) {
      return payload as ApiResponse<T>;
    }

    return {
      success: true,
      data: payload as T,
    };
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof DOMException && error.name === 'AbortError') {
      return {
        success: false,
        error: `Request timed out after ${Math.round(timeoutMs / 1000)} seconds. The service may be starting up — please try again.`,
      };
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Network error or backend unreachable: ${message}`,
    };
  }
}

// MS6: Agentic RAG Chat Inference
export async function chatInference(videoId: string, prompt: string, history: ChatMessage[]) {
  const user = getStoredUser();
  const response = await microserviceRequest<Ms6ChatResponse>(joinUrl(MS6_BASE_URL, '/api/v1/chat'), {
    method: 'POST',
    body: JSON.stringify({
      video_id: videoId,
      user_id: user?.id,
      question: prompt,
      conversation_history: history,
    }),
  }, 120000);

  if (!response.success || !response.data) {
    const rawError = response.error ?? 'Unable to reach MS6 chat endpoint';

    if (/Requested video not found or not yet indexed\.?/i.test(rawError)) {
      const statusResp = await microserviceRequest<Ms3VideoStatusResponse>(
        joinUrl(MS3_BASE_URL, `/video/${videoId}/status`),
        {},
        10000,
      );

      if (statusResp.success && statusResp.data?.status) {
        if (statusResp.data.status.toLowerCase() !== 'ready') {
          return {
            success: false,
            error: 'This video is still being indexed. Please wait a minute and try chat again.',
          } as ApiResponse<{ reply: string; sources: SearchResult[]; citations: Citation[] }>;
        }

        return {
          success: false,
          error: 'Video appears indexed, but MS6 could not retrieve chunks. Check that MS6 and MS3 are pointing to the same deployment environment.',
        } as ApiResponse<{ reply: string; sources: SearchResult[]; citations: Citation[] }>;
      }

      return {
        success: false,
        error: 'This video is not indexed in MS3 yet. Please wait for processing to finish and retry.',
      } as ApiResponse<{ reply: string; sources: SearchResult[]; citations: Citation[] }>;
    }

    return {
      success: false,
      error: rawError,
    } as ApiResponse<{ reply: string; sources: SearchResult[]; citations: Citation[] }>;
  }

  const citations = (response.data.citations ?? []).map((citation) => ({
    videoId: citation.video_id,
    startTime: citation.start_time,
    endTime: citation.end_time,
    text: citation.text,
    source: citation.source,
  }));

  const sources: SearchResult[] = citations.map((citation, index) => ({
    id: `citation-${index}`,
    timestampSec: citation.startTime,
    text: citation.text,
    score: 1,
  }));

  return {
    success: true,
    data: {
      reply: response.data.answer,
      sources,
      citations,
    },
  };
}

// MS7: PDF Export Dispatcher
export async function triggerPdfExport(videoId: string, chatHistory: ChatMessage[]) {
  const lastUser = [...chatHistory].reverse().find((msg) => msg.role === 'user');
  const lastAssistant = [...chatHistory].reverse().find((msg) => msg.role === 'assistant');

  if (!lastUser || !lastAssistant) {
    return {
      success: false,
      error: 'Need at least one user question and one assistant answer before exporting.',
    } as ApiResponse<ExportResult>;
  }

  const response = await microserviceRequest<Ms7ExportResponse>(joinUrl(MS7_BASE_URL, '/api/v1/export/chat'), {
    method: 'POST',
    body: JSON.stringify({
      title: `Video Q&A Report (${videoId.slice(0, 8)})`,
      question: lastUser.content,
      answer: lastAssistant.content,
      citations: [],
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to reach MS7 export endpoint',
    } as ApiResponse<ExportResult>;
  }

  return {
    success: true,
    data: {
      downloadUrl: response.data.download_url,
      s3Key: response.data.s3_key,
      expiresInSeconds: response.data.expires_in_seconds,
    },
  };
}

// MS3: Semantic Vector Search
export async function searchVideo(videoId: string, query: string) {
  const response = await microserviceRequest<Ms3SearchResponse>(
    withQuery(joinUrl(MS3_BASE_URL, '/search'), {
      query,
      video_id: videoId,
      limit: 8,
    }),
  );

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to reach MS3 search endpoint',
    } as ApiResponse<SearchResult[]>;
  }

  const normalized = response.data.results.map((item) => ({
    id: `${item.video_id}-${item.chunk_id}`,
    timestampSec: item.start_time,
    text: item.text,
    score: item.score,
  }));

  return {
    success: true,
    data: normalized,
  };
}

// Transcript retrieval uses MS3 indexed chunks as a stable transcript source.
export async function getTranscripts(videoId: string) {
  const response = await microserviceRequest<Ms3ChunkResponse>(
    withQuery(joinUrl(MS3_BASE_URL, `/video/${videoId}/chunks`), {
      source: 'audio',
    }),
  );

  if (!response.success || !response.data) {
    const rawError = response.error ?? 'Unable to fetch transcript chunks from MS3';

    if (/video not found/i.test(rawError)) {
      const statusResp = await microserviceRequest<Ms3VideoStatusResponse>(
        joinUrl(MS3_BASE_URL, `/video/${videoId}/status`),
        {},
        10000,
      );

      if (statusResp.success && statusResp.data?.status) {
        if (statusResp.data.status.toLowerCase() !== 'ready') {
          return {
            success: false,
            error: 'This video is still being indexed in MS3. Transcript chunks should appear shortly.',
          } as ApiResponse<TranscriptSegment[]>;
        }

        return {
          success: false,
          error: 'MS3 reports this video as ready, but transcript chunks are not readable yet. Retrying should succeed shortly.',
        } as ApiResponse<TranscriptSegment[]>;
      }

      return {
        success: false,
        error: 'This video has not been indexed in MS3 yet. Wait for processing to finish and retry.',
      } as ApiResponse<TranscriptSegment[]>;
    }

    return {
      success: false,
      error: rawError,
    } as ApiResponse<TranscriptSegment[]>;
  }

  return {
    success: true,
    data: response.data.map((chunk) => ({
      id: String(chunk.id),
      startSec: chunk.start_time,
      endSec: chunk.end_time,
      text: chunk.text,
    })),
  };
}

export async function summarizeVideo(videoId: string, style = 'concise') {
  const user = getStoredUser();
  const response = await microserviceRequest<Ms6SummarizeResponse>(joinUrl(MS6_BASE_URL, '/api/v1/summarize'), {
    method: 'POST',
    body: JSON.stringify({
      video_id: videoId,
      user_id: user?.id,
      style,
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to reach MS6 summarize endpoint',
    } as ApiResponse<SummaryResult>;
  }

  return {
    success: true,
    data: {
      videoId: response.data.video_id,
      summary: response.data.summary,
      chapters: (response.data.chapters ?? []).map((chapter) => ({
        title: chapter.title,
        startSec: chapter.start_time,
        endSec: chapter.end_time,
        summary: chapter.summary,
      })),
    },
  };
}

export async function runResearch(topic: string, videoIds: string[] = []) {
  const user = getStoredUser();
  const response = await microserviceRequest<Ms6ResearchResponse>(joinUrl(MS6_BASE_URL, '/api/v1/research'), {
    method: 'POST',
    body: JSON.stringify({
      user_id: user?.id,
      topic,
      video_ids: videoIds,
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to reach MS6 research endpoint',
    } as ApiResponse<ResearchResult>;
  }

  return {
    success: true,
    data: {
      report: response.data.report,
      sourcesUsed: response.data.sources_used,
      videosAnalyzed: response.data.videos_analyzed,
      iterationsTaken: response.data.iterations_taken,
    },
  };
}

export async function exportSummaryPdf(payload: SummaryResult) {
  const response = await microserviceRequest<Ms7ExportResponse>(joinUrl(MS7_BASE_URL, '/api/v1/export/summarize'), {
    method: 'POST',
    body: JSON.stringify({
      video_id: payload.videoId,
      title: 'Video Summary Report',
      summary: payload.summary,
      chapters: payload.chapters.map((chapter) => ({
        title: chapter.title,
        start_time: chapter.startSec,
        end_time: chapter.endSec,
        summary: chapter.summary,
      })),
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to export summary via MS7',
    } as ApiResponse<ExportResult>;
  }

  return {
    success: true,
    data: {
      downloadUrl: response.data.download_url,
      s3Key: response.data.s3_key,
      expiresInSeconds: response.data.expires_in_seconds,
    },
  };
}

export async function exportResearchPdf(topic: string, result: ResearchResult) {
  const response = await microserviceRequest<Ms7ExportResponse>(joinUrl(MS7_BASE_URL, '/api/v1/export/research'), {
    method: 'POST',
    body: JSON.stringify({
      topic,
      title: 'Research Report',
      report: result.report,
      sources_used: result.sourcesUsed,
      videos_analyzed: result.videosAnalyzed,
    }),
  });

  if (!response.success || !response.data) {
    return {
      success: false,
      error: response.error ?? 'Unable to export research report via MS7',
    } as ApiResponse<ExportResult>;
  }

  return {
    success: true,
    data: {
      downloadUrl: response.data.download_url,
      s3Key: response.data.s3_key,
      expiresInSeconds: response.data.expires_in_seconds,
    },
  };
}

export async function fetchServiceHealth(): Promise<ApiResponse<ServiceHealth[]>> {
  const checks: Array<Pick<ServiceHealth, 'key' | 'label' | 'baseUrl'>> = [
    { key: 'ms1', label: 'MS1 Media Processor', baseUrl: MS1_BASE_URL },
    { key: 'ms2', label: 'MS2 AI Perception', baseUrl: MS2_BASE_URL },
    { key: 'ms3', label: 'MS3 Search Index', baseUrl: MS3_BASE_URL },
    { key: 'ms4', label: 'MS4 Orchestrator', baseUrl: API_BASE_URL },
    { key: 'ms5', label: 'MS5 Analytics', baseUrl: MS5_BASE_URL },
    { key: 'ms6', label: 'MS6 Agentic Brain', baseUrl: MS6_BASE_URL },
    { key: 'ms7', label: 'MS7 PDF Export', baseUrl: MS7_BASE_URL },
  ];

  const results = await Promise.all(
    checks.map(async (item) => {
      const healthUrl = joinUrl(item.baseUrl, '/health');
      try {
        const response = await fetch(healthUrl, { cache: 'no-store' });
        const contentType = response.headers.get('content-type') ?? '';
        const payload = contentType.includes('application/json') ? await response.json() : null;
        return {
          key: item.key,
          label: item.label,
          baseUrl: item.baseUrl,
          ok: response.ok,
          statusCode: response.status,
          payload,
          error: response.ok ? undefined : getErrorMessage(payload, response.statusText),
        } as ServiceHealth;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Unreachable';
        return {
          key: item.key,
          label: item.label,
          baseUrl: item.baseUrl,
          ok: false,
          error: message,
        } as ServiceHealth;
      }
    }),
  );

  return {
    success: true,
    data: results,
  };
}

import { apiRequest } from '../lib/http';
import { PaginatedResponse } from '../types/api';
import { Video, VideoDetails, VideoStatus } from '../types/domain';
import { API_BASE_URL } from '../lib/constants';
import { getStoredToken } from '../lib/storage';

export async function fetchLibrary(query?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: VideoStatus | '';
}) {
  const params = new URLSearchParams();

  if (query?.page) {
    params.set('page', String(query.page));
  }
  if (query?.limit) {
    params.set('limit', String(query.limit));
  }
  if (query?.search) {
    params.set('search', query.search);
  }
  if (query?.status) {
    params.set('status', query.status);
  }

  const token = getStoredToken();

  const response = await fetch(`${API_BASE_URL}/api/videos?${params.toString()}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: 'no-store',
  });

  if (!response.ok) {
    return {
      success: false,
      data: [],
      pagination: {
        page: query?.page ?? 1,
        limit: query?.limit ?? 9,
        total: 0,
        totalPages: 0,
      },
    };
  }

  return (await response.json()) as PaginatedResponse<Video>;
}

export function fetchVideoDetails(videoId: string) {
  return apiRequest<VideoDetails>(`/api/videos/${videoId}`);
}

export function renameVideo(videoId: string, title: string) {
  return apiRequest<Video>(`/api/videos/${videoId}/rename`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
}

export function deleteVideo(videoId: string) {
  return apiRequest<{ id: string; status: VideoStatus; message: string }>(`/api/videos/${videoId}`, {
    method: 'DELETE',
  });
}

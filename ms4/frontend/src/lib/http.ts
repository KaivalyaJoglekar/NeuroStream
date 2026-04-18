import { API_BASE_URL } from './constants';
import { getStoredToken } from './storage';
import { ApiResponse } from '../types/api';

async function parseJson<T>(res: Response): Promise<ApiResponse<T>> {
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return (await res.json()) as ApiResponse<T>;
  }
  return {
    success: false,
    error: 'Invalid server response format.',
  };
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const token = getStoredToken();
  const headers = new Headers(options.headers);

  if (!headers.has('Content-Type') && options.body) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      cache: 'no-store',
    });

    const data = await parseJson<T>(response);

    if (!response.ok && data.error) {
      return {
        success: false,
        error: data.error,
        message: data.message,
      };
    }

    return data;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: 'Network error or backend unreachable: ' + message,
    };
  }
}

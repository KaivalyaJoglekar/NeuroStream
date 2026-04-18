import { apiRequest } from '../lib/http';

type InitiateUploadRequest = {
  filename: string;
  contentType: string;
  fileSize: number;
  title?: string;
  description?: string;
};

type InitiateUploadResponse = {
  uploadUrl: string;
  objectKey: string;
  expiresIn: number;
  bucket: string;
};

export async function initiateUpload(payload: InitiateUploadRequest) {
  return apiRequest<InitiateUploadResponse>('/api/upload/initiate', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function uploadToObjectStorage(uploadUrl: string, file: File) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type,
    },
    body: file,
  });

  if (!res.ok) {
    throw new Error('Failed to upload file to object storage.');
  }
}

export function completeUpload(payload: {
  objectKey: string;
  title: string;
  description?: string;
  metadata?: Record<string, string>;
}) {
  return apiRequest<{ videoId: string; status: string; message: string }>('/api/upload/complete', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

import { apiRequest } from '../lib/http';
import { User } from '../types/domain';

type AuthPayload = {
  token: string;
  user: User;
};

export function register(payload: { name: string; email: string; password: string }) {
  return apiRequest<AuthPayload>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(payload: { email: string; password: string }) {
  return apiRequest<AuthPayload>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

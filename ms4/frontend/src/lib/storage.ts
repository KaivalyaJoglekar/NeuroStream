import { TOKEN_KEY, USER_KEY } from './constants';
import { User } from '../types/domain';

export function getStoredToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setStoredToken(token: string): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(TOKEN_KEY, token);
  }
}

export function clearStoredToken(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(TOKEN_KEY);
  }
}

export function setStoredUser(user: User): void {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(USER_KEY, JSON.stringify(user));
  }
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw = window.localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as User;
  } catch {
    return null;
  }
}

export function clearStoredUser(): void {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(USER_KEY);
  }
}

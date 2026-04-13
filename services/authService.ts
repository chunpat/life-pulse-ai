
import { User } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/auth';

export interface AppleLoginPayload {
  identityToken: string;
  authorizationCode: string;
  email?: string | null;
  givenName?: string | null;
  familyName?: string | null;
}

export const authService = {
  async register(name: string, email: string, password: string, referrerId?: string, source?: string): Promise<{ token: string; user: User }> {
    return apiClient(`${API_BASE_URL}/register`, {
      method: 'POST',
      body: { name, email, password, referrerId, source },
    });
  },

  async login(nickname: string, password: string): Promise<{ token: string; user: User }> {
    return apiClient(`${API_BASE_URL}/login`, {
      method: 'POST',
      body: { name: nickname, password },
    });
  },

  async loginWithApple(payload: AppleLoginPayload): Promise<{ token: string; user: User }> {
    return apiClient(`${API_BASE_URL}/apple`, {
      method: 'POST',
      body: payload,
    });
  }
};

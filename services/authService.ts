
import { User } from '../types';

const API_BASE_URL = '/api/auth';

export const authService = {
  async register(name: string, email: string, password: string): Promise<{ token: string; user: User }> {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '注册失败');
    }
    
    return response.json();
  },

  async login(nickname: string, password: string): Promise<{ token: string; user: User }> {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: nickname, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || '登录失败');
    }
    
    return response.json();
  }
};

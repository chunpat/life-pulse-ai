import { RewardBadge, RewardLedgerEntry, RewardProfile } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/rewards';
const TOKEN_KEY = 'lifepulse_token';

const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));

export const fetchRewardProfile = async (): Promise<RewardProfile | null> => {
  if (!hasToken()) return null;
  return apiClient(`${API_BASE_URL}/profile`);
};

export const fetchRewardLedger = async (limit = 20): Promise<RewardLedgerEntry[]> => {
  if (!hasToken()) return [];
  return apiClient(`${API_BASE_URL}/ledger`, {
    params: {
      limit: String(limit)
    }
  });
};

export const fetchRewardBadges = async (limit?: number): Promise<RewardBadge[]> => {
  if (!hasToken()) return [];
  return apiClient(`${API_BASE_URL}/badges`, {
    params: {
      ...(typeof limit === 'number' ? { limit: String(limit) } : {})
    }
  });
};
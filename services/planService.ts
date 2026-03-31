import { Plan, PlanCreateInput, PlanListQuery, PlanUpdateInput } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/plans';
const TOKEN_KEY = 'lifepulse_token';

const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));

export const fetchPlans = async (query?: PlanListQuery): Promise<Plan[]> => {
  if (!hasToken()) return [];
  return apiClient(API_BASE_URL, { params: query as Record<string, string> | undefined });
};

export const fetchPlanById = async (planId: string): Promise<Plan> => {
  return apiClient(`${API_BASE_URL}/${planId}`);
};

export const createPlan = async (payload: PlanCreateInput): Promise<Plan> => {
  return apiClient(API_BASE_URL, {
    method: 'POST',
    body: payload
  });
};

export const updatePlan = async (planId: string, payload: PlanUpdateInput): Promise<Plan> => {
  return apiClient(`${API_BASE_URL}/${planId}`, {
    method: 'PUT',
    body: payload
  });
};

export const completePlan = async (planId: string): Promise<Plan> => {
  return apiClient(`${API_BASE_URL}/${planId}/complete`, {
    method: 'POST'
  });
};

export const cancelPlan = async (planId: string): Promise<Plan> => {
  return apiClient(`${API_BASE_URL}/${planId}/cancel`, {
    method: 'POST'
  });
};

export const deletePlan = async (planId: string): Promise<void> => {
  await apiClient(`${API_BASE_URL}/${planId}`, {
    method: 'DELETE'
  });
};
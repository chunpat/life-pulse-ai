import { Goal, GoalCheckin, GoalCreateInput } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/goals';
const TOKEN_KEY = 'lifepulse_token';

const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));

export const fetchGoals = async (): Promise<Goal[]> => {
  if (!hasToken()) return [];
  return apiClient(API_BASE_URL);
};

export const fetchActiveGoals = async (): Promise<Goal[]> => {
  if (!hasToken()) return [];
  return apiClient(`${API_BASE_URL}/active`);
};

export const createGoal = async (goalInput: GoalCreateInput): Promise<Goal> => {
  return apiClient(API_BASE_URL, {
    method: 'POST',
    body: goalInput
  });
};

export const pauseGoal = async (goalId: string): Promise<Goal> => {
  return apiClient(`${API_BASE_URL}/${goalId}/pause`, {
    method: 'POST'
  });
};

export const resumeGoal = async (goalId: string): Promise<Goal> => {
  return apiClient(`${API_BASE_URL}/${goalId}/resume`, {
    method: 'POST'
  });
};

export const completeGoal = async (goalId: string): Promise<Goal> => {
  return apiClient(`${API_BASE_URL}/${goalId}/complete`, {
    method: 'POST'
  });
};

export const setPrimaryGoal = async (goalId: string): Promise<Goal> => {
  return apiClient(`${API_BASE_URL}/${goalId}/set-primary`, {
    method: 'POST'
  });
};

export const deleteGoal = async (goalId: string): Promise<void> => {
  await apiClient(`${API_BASE_URL}/${goalId}`, {
    method: 'DELETE'
  });
};

export const fetchGoalCheckins = async (goalId: string): Promise<{ goal: Goal; checkins: GoalCheckin[] }> => {
  return apiClient(`${API_BASE_URL}/${goalId}/checkins`);
};
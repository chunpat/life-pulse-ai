import { OfficialPlanTemplate } from '../types';
import { apiClient } from './apiClient';

const API_BASE_URL = '/api/official-plans';

export const fetchOfficialPlanTemplates = async (): Promise<OfficialPlanTemplate[]> => {
  return apiClient(API_BASE_URL);
};
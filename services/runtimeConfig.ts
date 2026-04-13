import { Capacitor } from '@capacitor/core';

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const getConfiguredApiBaseUrl = () => {
  if (Capacitor.isNativePlatform()) {
    const nativeBaseUrl = import.meta.env.VITE_NATIVE_API_BASE_URL?.trim();
    if (nativeBaseUrl) {
      return trimTrailingSlash(nativeBaseUrl);
    }
  }

  const sharedBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (sharedBaseUrl) {
    return trimTrailingSlash(sharedBaseUrl);
  }

  return '';
};

export const runtimeConfig = {
  apiBaseUrl: getConfiguredApiBaseUrl(),
  platform: Capacitor.getPlatform(),
  isNativePlatform: Capacitor.isNativePlatform(),
  isNativeIos: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
};

export const buildApiUrl = (endpoint: string) => {
  if (/^https?:\/\//i.test(endpoint)) {
    return endpoint;
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  return runtimeConfig.apiBaseUrl
    ? `${runtimeConfig.apiBaseUrl}${normalizedEndpoint}`
    : normalizedEndpoint;
};
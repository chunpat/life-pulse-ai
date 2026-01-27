
const TOKEN_KEY = 'lifepulse_token';

interface RequestOptions extends RequestInit {
  params?: Record<string, string>;
}

export const apiClient = async (endpoint: string, options: RequestOptions = {}) => {
  const { params, headers, ...customConfig } = options;
  const token = localStorage.getItem(TOKEN_KEY);

  const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

  const isFormData = options.body instanceof FormData;
  
  const config: RequestInit = {
    method: options.method || (options.body ? 'POST' : 'GET'),
    ...customConfig,
    headers: {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...authHeader,
      ...headers,
    },
  };

  if (options.body && typeof options.body === 'object' && !isFormData) {
    config.body = JSON.stringify(options.body);
  } else if (isFormData) {
    config.body = options.body;
  }

  let url = endpoint;
  if (params) {
    const searchParams = new URLSearchParams(params);
    url += `?${searchParams.toString()}`;
  }

  try {
    const response = await fetch(url, config);

    if (response.status === 401 || response.status === 403) {
      // Token 过期或无效 (401: Unauthorized, 403: Forbidden - sometimes used for expired tokens)
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem('guest_user_v1'); // 同时也清除用户信息
      window.dispatchEvent(new CustomEvent('unauthorized'));
      throw new Error('登录已过期，请重新登录');
    }

    if (!response.ok) {
        // 其他错误
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || '网络请求失败');
    }

    // 处理 204 No Content
    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('API Request Error:', error);
    throw error;
  }
};

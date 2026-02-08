import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/dev',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add API key and logging
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Add API key to headers if available
    const apiKey = import.meta.env.VITE_API_KEY;
    if (apiKey && config.headers) {
      config.headers['x-api-key'] = apiKey;
    }

    // Log request in development
    if (import.meta.env.DEV) {
      console.log(`[API Request] ${config.method?.toUpperCase()} ${config.url}`, {
        params: config.params,
        data: config.data,
      });
    }

    return config;
  },
  (error: AxiosError) => {
    console.error('[API Request Error]', error);
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors and logging
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    // Log response in development
    if (import.meta.env.DEV) {
      console.log(`[API Response] ${response.config.method?.toUpperCase()} ${response.config.url}`, {
        status: response.status,
        data: response.data,
      });
    }

    return response;
  },
  (error: AxiosError) => {
    // Enhanced error handling
    if (error.response) {
      // Server responded with error status
      console.error('[API Error Response]', {
        status: error.response.status,
        data: error.response.data,
        url: error.config?.url,
      });

      // Handle specific error cases
      switch (error.response.status) {
        case 401:
          console.error('Unauthorized - Invalid API key');
          break;
        case 403:
          console.error('Forbidden - Access denied');
          break;
        case 404:
          console.error('Not found - Resource does not exist');
          break;
        case 429:
          console.error('Too many requests - Rate limit exceeded');
          break;
        case 500:
          console.error('Internal server error');
          break;
        default:
          console.error(`API Error: ${error.response.status}`);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('[API No Response]', error.request);
      console.error('Network error - No response from server');
    } else {
      // Error setting up request
      console.error('[API Request Setup Error]', error.message);
    }

    return Promise.reject(error);
  }
);

export default apiClient;

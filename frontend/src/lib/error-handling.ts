import axios from 'axios';

/**
 * Transform API errors into user-friendly messages
 * @param error - The error object from API call
 * @returns User-friendly error message
 */
export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response) {
      // Server responded with error status
      const status = error.response.status;

      switch (status) {
        case 400:
          return 'Invalid search query. Please try different keywords.';
        case 401:
        case 403:
          return 'Access denied. Please contact support.';
        case 404:
          return 'Service temporarily unavailable. Please try again later.';
        case 429:
          return 'Too many requests. Please wait a moment and try again.';
        case 500:
        case 502:
        case 503:
          return 'Server error. Please try again in a few moments.';
        default:
          return `Server error: ${status}. Please try again.`;
      }
    } else if (error.request) {
      // No response received - network error
      return 'Unable to connect to server. Please check your internet connection.';
    } else if (error.code === 'ECONNABORTED') {
      // Request timeout
      return 'Request timed out. Please try again.';
    }
  }

  return 'An unexpected error occurred. Please try again.';
}

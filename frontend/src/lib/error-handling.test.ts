import { describe, it, expect } from 'vitest';
import axios from 'axios';
import { getErrorMessage } from './error-handling';

describe('getErrorMessage', () => {
  it('should return correct message for 400 Bad Request', () => {
    const error = {
      isAxiosError: true,
      response: { status: 400 },
    };
    expect(getErrorMessage(error)).toBe('Invalid search query. Please try different keywords.');
  });

  it('should return correct message for 401 Unauthorized', () => {
    const error = {
      isAxiosError: true,
      response: { status: 401 },
    };
    expect(getErrorMessage(error)).toBe('Access denied. Please contact support.');
  });

  it('should return correct message for 404 Not Found', () => {
    const error = {
      isAxiosError: true,
      response: { status: 404 },
    };
    expect(getErrorMessage(error)).toBe('Service temporarily unavailable. Please try again later.');
  });

  it('should return correct message for 429 Rate Limit', () => {
    const error = {
      isAxiosError: true,
      response: { status: 429 },
    };
    expect(getErrorMessage(error)).toBe('Too many requests. Please wait a moment and try again.');
  });

  it('should return correct message for 500 Server Error', () => {
    const error = {
      isAxiosError: true,
      response: { status: 500 },
    };
    expect(getErrorMessage(error)).toBe('Server error. Please try again in a few moments.');
  });

  it('should return correct message for network error', () => {
    const error = {
      isAxiosError: true,
      request: {},
    };
    expect(getErrorMessage(error)).toBe('Unable to connect to server. Please check your internet connection.');
  });

  it('should return correct message for timeout', () => {
    const error = {
      isAxiosError: true,
      code: 'ECONNABORTED',
    };
    expect(getErrorMessage(error)).toBe('Request timed out. Please try again.');
  });

  it('should return default message for unknown error', () => {
    const error = new Error('Something went wrong');
    expect(getErrorMessage(error)).toBe('An unexpected error occurred. Please try again.');
  });
});

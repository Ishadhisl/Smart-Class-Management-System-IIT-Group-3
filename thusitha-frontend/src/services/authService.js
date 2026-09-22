// src/services/authService.js
import { request } from './api';

export const authService = {
  login: async (username, password) => {
    const data = await request('/auth/login', {
      method: 'POST',
      body: { username, password }
    });

    if (data.token) {
      sessionStorage.setItem('token', data.token);
    }

    if (data.user) {
      sessionStorage.setItem('user', JSON.stringify(data.user));
    }

    return data;
  },

  // Best-effort server-side session revocation. Callers should clear sessionStorage and
  // navigate away regardless of whether this call succeeds (token may already be expired).
  logout: () => request('/auth/logout', { method: 'POST' })
};
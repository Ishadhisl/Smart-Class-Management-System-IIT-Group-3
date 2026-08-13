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
  }
};
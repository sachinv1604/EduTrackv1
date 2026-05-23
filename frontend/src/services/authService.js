/**
 * Authentication Service
 * 
 * This service handles all the communication with the backend related 
 * to user identity (Login, Registration, Profile).
 */
import api from './api';

const authService = {
  /**
   * LOGIN
   * Sends user credentials to the server.
   * If successful, returns user data and token.
   */
  login: async (email, password) => {
    try {
      // POST request to /api/auth/login
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      /**
       * ERROR HANDLING PATTERN:
       * 1. If no "error.response", it means the phone couldn't even reach the server 
       *    (Network down, wrong IP, or Server is off).
       */
      if (!error.response) {
        throw 'Cannot connect to server. Please check your network or BASE_URL.';
      }
      // 2. If server replied with 401 or 403, we show the message from the backend.
      throw error.response?.data?.message || 'Error occurred during login';
    }
  },

  /**
   * REGISTER
   * Sends the registration form data to the server.
   */
  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Please check your network or BASE_URL.';
      }
      throw error.response?.data?.message || 'Error occurred during registration';
    }
  },

  /**
   * GET ME (Fetch Profile)
   * Fetches the current logged-in user's details.
   */
  getMe: async () => {
    try {
      const response = await api.get('/auth/me');
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Please check your network or BASE_URL.';
      }
      throw error.response?.data?.message || 'Error occurred while fetching profile';
    }
  },

  /**
   * FORGOT PASSWORD (v3 Upgrade)
   * Sends the user's email address to request a secure OTP code.
   */
  forgotPassword: async (email) => {
    try {
      const response = await api.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Please check your network or BASE_URL.';
      }
      throw error.response?.data?.message || 'Error requesting verification OTP';
    }
  },

  /**
   * RESET PASSWORD (v3 Upgrade)
   * Submits the OTP code and new password to complete the reset flow.
   */
  resetPassword: async (email, otp, newPassword) => {
    try {
      const response = await api.post('/auth/reset-password', { email, otp, newPassword });
      return response.data;
    } catch (error) {
      if (!error.response) {
        throw 'Cannot connect to server. Please check your network or BASE_URL.';
      }
      throw error.response?.data?.message || 'Error occurred while resetting password';
    }
  }
};

export default authService;

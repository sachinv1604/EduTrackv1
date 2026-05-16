/**
 * API Service Configuration
 * 
 * We use a library called "Axios" to send HTTP requests to our Node.js server.
 * Instead of typing the full URL every time, we create a reusable "api" instance.
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

/**
 * 1. BASE URL LOGIC
 * 
 * We now use Expo Environment Variables for production deployments.
 * Create a .env file in the frontend folder with EXPO_PUBLIC_API_URL=https://your-render-url.com/api
 * If not found, it falls back to the local development URLs.
 */
const BASE_URL = 'https://edutrack-backend-ypui.onrender.com/api';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * 2. REQUEST INTERCEPTOR (The "Automatic ID Card")
 * An interceptor is a function that runs BEFORE every single request.
 * 
 * Why? 
 * Instead of manually adding the JWT token to every screen's code, 
 * we do it here once. This function grabs the token from the phone's 
 * memory (AsyncStorage) and sticks it into the "Authorization" header.
 */
api.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('userToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`; // Add the "ID Card"
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;

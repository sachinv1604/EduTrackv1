/**
 * Authentication Context (The "Global State")
 * 
 * In React Native, data usually flows from parent to child via "props". 
 * But the "User Login" status is needed everywhere! 
 * Context lets us "broadcast" the user data to every single screen 
 * without passing props manually.
 */
import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import trackingService from '../services/trackingService';
import { registerForPushNotificationsAsync } from '../services/notificationService';

// 1. Create the Context object
const AuthContext = createContext();

/**
 * 2. AUTH PROVIDER
 * This component wraps the entire app. It holds the "Source of Truth" 
 * for whether a user is logged in or not.
 */
export const AuthProvider = ({ children }) => {
  const [userToken, setUserToken] = useState(null); // The JWT string
  const [user, setUser] = useState(null); // The full User object
  const [isLoading, setIsLoading] = useState(true); // Is the app still checking memory?

  /**
   * ON START: checkLoginStatus
   * When the app first opens, we check the phone's memory (AsyncStorage) 
   * to see if the user was already logged in from last time.
   * We also refresh the FCM push token so it stays current.
   */
  useEffect(() => {
    const checkLoginStatus = async () => {
      console.log('[AUTH_CHECK] Checking AsyncStorage for session...');
      try {
        const token = await AsyncStorage.getItem('userToken');
        const userData = await AsyncStorage.getItem('userData');
        if (token) {
          console.log('[AUTH_CHECK] Session found! Token exists.');
          setUserToken(token);
          if (userData) {
            setUser(JSON.parse(userData));
          }
          // Refresh FCM token on app restart (tokens can rotate)
          registerForPushNotificationsAsync().catch(e =>
            console.warn('[AUTH_CHECK] FCM token refresh failed:', e)
          );
        } else {
          console.log('[AUTH_CHECK] No existing session found.');
        }
      } catch (error) {
        console.error('[AuthContext] Error checking login status:', error);
      } finally {
        setIsLoading(false);
      }
    };
    checkLoginStatus();
  }, []);

  const login = async (token, userData) => {
    console.log('[AUTH_LOGIN] Saving user credentials to memory...');
    try {
      await AsyncStorage.setItem('userToken', token);
      await AsyncStorage.setItem('userData', JSON.stringify(userData));
      setUserToken(token);
      setUser(userData);
      console.log('[AUTH_LOGIN] Login success! User:', userData.name);

      // Register device for push notifications after successful login
      registerForPushNotificationsAsync().catch(e =>
        console.warn('[AUTH_LOGIN] FCM token registration failed:', e)
      );
    } catch (error) {
      console.error('[AuthContext] Error during login storage:', error);
    }
  };

  const logout = async () => {
    console.log('[AUTH_LOGOUT] Clearing session data...');
    try {
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('userData');
      setUserToken(null);
      setUser(null);
      // GLOBAL CLEANUP: Kill any background tracking heartbeats
      trackingService.stopTracking();
      console.log('[AUTH_LOGOUT] User logged out.');
    } catch (error) {
      console.error('[AuthContext] Error during logout storage:', error);
    }
  };

  /**
   * 3. PROVIDER VALUE
   * Everything in this 'value' object is now available to any screen 
   * in the app that asks for it.
   */
  return (
    <AuthContext.Provider value={{ userToken, user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * 4. CUSTOM HOOK: useAuth
 * Instead of importing 'useContext(AuthContext)' everywhere, 
 * screens just call 'useAuth()'. It's cleaner!
 */
export const useAuth = () => useContext(AuthContext);

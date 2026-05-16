/**
 * User Management Service
 * 
 * Handles administrative tasks like approvals, role updates, 
 * and fetching user lists (e.g., student lists for a coordinator).
 */
import api from './api';

const userService = {
  /**
   * COORDINATOR: Get Students
   * Fetches the list of students who belong to the coordinator's bus.
   */
  getRouteStudents: async () => {
    try {
      const response = await api.get('/users/route-students');
      return response.data;
    } catch (error) {
      console.error('[UserService] Error fetching route students:', error);
      throw error.response?.data?.message || 'Error fetching student list';
    }
  },

  /**
   * NOTIFICATIONS: Update Token
   * Syncs the device's Push Token with the backend.
   */
  updateFCMToken: async (fcmToken) => {
    try {
      const response = await api.post('/users/fcm-token', { fcmToken });
      return response.data;
    } catch (error) {
      console.error('[UserService] Error updating FCM token:', error);
      throw error.response?.data?.message || 'Error updating push notifications';
    }
  },

  /**
   * ADMIN: List Users by Role
   * Used to see all Drivers, Coordinators, or Students.
   */
  getUsersByRole: async (role) => {
    try {
      const response = await api.get(`/users/role/${role}`);
      return response.data;
    } catch (error) {
      console.error(`[UserService] Error fetching users for role ${role}:`, error);
      throw error.response?.data?.message || `Error fetching ${role} list`;
    }
  },

  /**
   * ADMIN: Change User Role
   * Promote or demote a user (e.g., change User to Admin).
   */
  updateUserRole: async (userId, role) => {
    try {
      const response = await api.put(`/users/${userId}/role`, { role });
      return response.data;
    } catch (error) {
      console.error('[UserService] Error updating user role:', error);
      throw error.response?.data?.message || 'Error updating user role';
    }
  },

  /**
   * APPROVALS: Get Pending
   * Fetches the list of users waiting for an Admin/Coordinator to click "Approve".
   */
  getPendingApprovals: async () => {
    try {
      const response = await api.get('/users/pending-approvals');
      return response.data;
    } catch (error) {
      console.error('[UserService] Error fetching pending approvals:', error);
      throw error.response?.data?.message || 'Error fetching pending requests';
    }
  },

  /**
   * APPROVALS: Approve a User
   * Confirms a registration and allows the user to log in.
   */
  approveUser: async (userId) => {
    try {
      const response = await api.put(`/users/${userId}/approve`);
      return response.data;
    } catch (error) {
      console.error('[UserService] Error approving user:', error);
      throw error.response?.data?.message || 'Error approving user';
    }
  },

  /**
   * PROFILE: Get Current User
   * Fetches the full profile of the logged-in user.
   */
  getMe: async () => {
    try {
      const response = await api.get('/users/me');
      return response.data;
    } catch (error) {
      console.error('[UserService] Error fetching user profile:', error);
      throw error.response?.data?.message || 'Error fetching user profile';
    }
  }
};

export default userService;

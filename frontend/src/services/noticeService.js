/**
 * Notice & Announcement Service
 * 
 * Handles fetching announcements and broadcasting new ones.
 * Announcements can be plain text, or they can include "FormData" 
 * for uploading images/PDFs.
 */
import api from './api';

const noticeService = {
  /**
   * FETCH NOTICES
   * Gets the list of announcements relevant to the current user.
   */
  getNotices: async () => {
    try {
      const response = await api.get('/notices');
      return response.data;
    } catch (error) {
      console.error('[NoticeService] Error fetching notices:', error);
      throw error.response?.data?.message || 'Error fetching announcements';
    }
  },

  /**
   * CREATE / BROADCAST NOTICE
   * Sends a new announcement to the server.
   * 
   * Note: "noticeData" can be a simple Object (JSON) or a 
   * "FormData" object (if an image/PDF is attached). 
   * Axios is smart enough to set the correct "Content-Type" automatically.
   */
  createNotice: async (noticeData) => {
    try {
      const response = await api.post('/notices', noticeData);
      return response.data;
    } catch (error) {
      console.error('[NoticeService] Error creating notice:', error);
      throw error.response?.data?.message || 'Error broadcasting notice';
    }
  }
};

export default noticeService;

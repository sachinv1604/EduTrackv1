import api from './api';

const routeService = {
  getRoutes: async () => {
    try {
      const response = await api.get('/routes');
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error fetching routes';
    }
  },

  createRoute: async (routeData) => {
    try {
      const response = await api.post('/routes', routeData);
      return response.data;
    } catch (error) {
      throw error.response?.data?.message || 'Error creating route';
    }
  }
};

export default routeService;

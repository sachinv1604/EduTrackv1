const axios = require('axios');

const API_URL = 'http://localhost:5000/api/auth';

const testAuth = async () => {
  try {
    console.log('--- Starting Auth Flow Test ---');

    // 1. Register a new user
    const userData = {
      name: 'Test User',
      email: `test${Date.now()}@example.com`,
      phone: `${Date.now()}`.slice(-10),
      role: 'student',
      password: 'password123',
      collegeId: 'COL123'
    };

    console.log('Step 1: Registering User...');
    const registerRes = await axios.post(`${API_URL}/register`, userData);
    const token = registerRes.data.token;
    console.log('Registration Successful. Token received.');

    // 2. Login with the user
    console.log('Step 2: Logging in...');
    const loginRes = await axios.post(`${API_URL}/login`, {
      email: userData.email,
      password: userData.password
    });
    console.log('Login Successful. Token received.');

    // 3. Get profile (protected route)
    console.log('Step 3: Fetching Profile...');
    const profileRes = await axios.get(`${API_URL}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });
    console.log('Profile Fetch Successful. User:', profileRes.data.name);

    console.log('--- Auth Flow Test Successful ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Auth Flow Test Failed ---');
    if (error.response) {
      console.error('Error Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testAuth();

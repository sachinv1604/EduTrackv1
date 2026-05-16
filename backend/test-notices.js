const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');

const API_URL = 'http://localhost:5000/api';

const testNotices = async () => {
  try {
    console.log('--- Starting Notice & Notification Test ---');

    console.log('Step 1: Setting up environment...');
    
    // 1. Setup Admin
    const adminData = {
      name: 'Admin User',
      email: `admin${Date.now()}@example.com`,
      phone: `9${Date.now()}`.slice(-10),
      role: 'admin',
      password: 'adminpassword',
      collegeId: 'ADM001'
    };
    const adminReg = await axios.post(`${API_URL}/auth/register`, adminData);
    const adminToken = adminReg.data.token;

    // 2. Setup Student
    const studentData = {
      name: 'Student User',
      email: `student${Date.now()}@example.com`,
      phone: `7${Date.now()}`.slice(-10),
      role: 'student',
      password: 'studentpassword',
      collegeId: 'STU001'
    };
    const studentReg = await axios.post(`${API_URL}/auth/register`, studentData);
    const studentId = studentReg.data._id;
    const studentToken = studentReg.data.token;

    // 3. Create Route
    const routeRes = await axios.post(`${API_URL}/routes`, {
      name: 'Notification Route',
      checkpoints: [{ order: 1, name: 'Gate', location: { coordinates: [0,0] } }],
      estimatedTime: 5,
      polyline: 'line'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const routeId = routeRes.data._id;

    // 4. Subscribe Student to Route
    // 4. Subscribe Student to Route
    console.log('Step 1.1: Subscribing Student to Route...');
    await axios.put(`${API_URL}/auth/me`, { subscribedRoutes: [routeId] }, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });
    console.log('Subscription updated.');

    // 5. Update Student FCM Token
    console.log('Step 2: Updating Student FCM Token...');
    await axios.post(`${API_URL}/users/fcm-token`, { fcmToken: 'mock_fcm_token_123' }, {
        headers: { Authorization: `Bearer ${studentToken}` }
    });

    // 6. Create Notice (Targeting Role: student)
    console.log('Step 3: Creating and Broadcasting Notice...');
    const form = new FormData();
    form.append('title', 'Holiday Announcement');
    form.append('content', 'Tomorrow is a holiday due to technical maintenance.');
    form.append('targetRoles', JSON.stringify(['student']));
    form.append('targetRoutes', JSON.stringify([]));
    
    // Create a dummy file for attachment if needed
    // const dummyFile = path.join(__dirname, 'dummy.pdf');
    // fs.writeFileSync(dummyFile, 'dummy content');
    // form.append('attachment', fs.createReadStream(dummyFile));

    const noticeRes = await axios.post(`${API_URL}/notices`, form, {
      headers: { 
        ...form.getHeaders(),
        Authorization: `Bearer ${adminToken}` 
      }
    });
    console.log('Notice created successfully:', noticeRes.data.title);

    // 7. Verify Visibility for Student
    console.log('Step 4: Verifying visibility for Student...');
    const noticesRes = await axios.get(`${API_URL}/notices`, {
      headers: { Authorization: `Bearer ${studentToken}` }
    });
    
    const found = noticesRes.data.some(n => n.title === 'Holiday Announcement');
    if (found) {
      console.log('Notice is visible to Student. Test PASSED.');
    } else {
      console.error('Notice NOT visible to Student. Test FAILED.');
      process.exit(1);
    }

    console.log('--- Notice & Notification Test Successful ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Notice & Notification Test Failed ---');
    if (error.response) {
      console.error('Error Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testNotices();

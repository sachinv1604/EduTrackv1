const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const testManagement = async () => {
  try {
    console.log('--- Starting Management API Test ---');

    // 1. Setup Admin
    console.log('Step 1: Setting up Admin...');
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

    // 2. Setup Driver
    console.log('Step 2: Setting up Driver...');
    const driverData = {
      name: 'Driver User',
      email: `driver${Date.now()}@example.com`,
      phone: `8${Date.now()}`.slice(-10),
      role: 'driver',
      password: 'driverpassword',
      collegeId: 'DRV001'
    };
    const driverReg = await axios.post(`${API_URL}/auth/register`, driverData);
    const driverId = driverReg.data._id;
    const driverToken = driverReg.data.token;

    // 3. Create Route as Admin
    console.log('Step 3: Creating Route as Admin...');
    const routeRes = await axios.post(`${API_URL}/routes`, {
      name: 'Campus Express',
      checkpoints: [
        { order: 1, name: 'Main Gate', location: { coordinates: [77.5946, 12.9716] } },
        { order: 2, name: 'Library', location: { coordinates: [77.6046, 12.9816] } }
      ],
      estimatedTime: 15,
      polyline: 'abc_polyline_string'
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    const routeId = routeRes.data._id;
    console.log('Route created successfully.');

    // 4. Create Bus as Admin
    console.log('Step 4: Creating Bus as Admin...');
    const busRes = await axios.post(`${API_URL}/buses`, {
      registrationNo: `KA-01-ET-${Date.now()}`.slice(0, 15),
      capacity: 40,
      routeId: routeId,
      driverId: driverId
    }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    console.log('Bus created successfully.');

    // 5. Verify Population
    console.log('Step 5: Verifying Data Population...');
    const busesRes = await axios.get(`${API_URL}/buses`);
    const bus = busesRes.data.find(b => b._id === busRes.data._id);
    if (bus && bus.routeId && bus.driverId) {
      console.log('Population verified. Bus has route name:', bus.routeId.name);
      console.log('Population verified. Bus has driver name:', bus.driverId.name);
    } else {
      throw new Error('Population failed');
    }

    // 6. Test RBAC (Driver trying to create route)
    console.log('Step 6: Testing RBAC (Driver creating route)...');
    try {
      await axios.post(`${API_URL}/routes`, { name: 'Hack Route' }, {
        headers: { Authorization: `Bearer ${driverToken}` }
      });
      console.log('RBAC TEST FAILED: Driver was able to create a route!');
      process.exit(1);
    } catch (error) {
      if (error.response && error.response.status === 403) {
        console.log('RBAC TEST PASSED: Driver was denied access (403 Forbidden).');
      } else {
        throw error;
      }
    }

    console.log('--- Management API Test Successful ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Management API Test Failed ---');
    if (error.response) {
      console.error('Error Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testManagement();

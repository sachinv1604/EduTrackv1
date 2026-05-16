const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const testTracking = async () => {
  try {
    console.log('--- Starting Tracking Status Test ---');

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

    // 2. Setup Driver
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

    // 3. Create Route (3 checkpoints)
    const routeRes = await axios.post(`${API_URL}/routes`, {
      name: 'Multi-Stop Route',
      checkpoints: [
        { order: 1, name: 'Start Gate', location: { coordinates: [77.10, 13.10] } },
        { order: 2, name: 'Mid Mall', location: { coordinates: [77.11, 13.11] } },
        { order: 3, name: 'End Campus', location: { coordinates: [77.12, 13.12] } }
      ],
      estimatedTime: 30,
      polyline: 'multi_polyline'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const routeId = routeRes.data._id;

    // 4. Create and activate Bus
    const busRes = await axios.post(`${API_URL}/buses`, {
      registrationNo: `TRACK-B-${Date.now()}`.slice(0, 15),
      capacity: 50,
      routeId,
      driverId
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const busId = busRes.data._id;
    await axios.put(`${API_URL}/buses/${busId}`, { isActive: true }, {
        headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('Setup Complete.');

    // 5. Simulate movement past the first 2 checkpoints
    console.log('Step 2: Simulating movement past 2 checkpoints...');
    
    // Pass CP 0
    await axios.post(`${API_URL}/location`, { busId, lat: 13.10001, lng: 77.10001 }, { headers: { Authorization: `Bearer ${driverToken}` } }); // Arrive
    await axios.post(`${API_URL}/location`, { busId, lat: 13.10150, lng: 77.10150 }, { headers: { Authorization: `Bearer ${driverToken}` } }); // Depart
    
    // Pass CP 1
    await axios.post(`${API_URL}/location`, { busId, lat: 13.11001, lng: 77.11001 }, { headers: { Authorization: `Bearer ${driverToken}` } }); // Arrive
    await axios.post(`${API_URL}/location`, { busId, lat: 13.11150, lng: 77.11150 }, { headers: { Authorization: `Bearer ${driverToken}` } }); // Depart

    console.log('Movement simulation complete.');

    // 6. Fetch tracking status
    console.log('Step 3: Fetching tracking status...');
    const statusRes = await axios.get(`${API_URL}/tracking/${busId}/status`);
    const data = statusRes.data;

    console.log('Status Response:', { 
      bus: data.registrationNo,
      lastDepartedIndex: data.lastDepartedCheckpointIndex
    });

    // Verification
    const cp0 = data.checkpoints[0];
    const cp1 = data.checkpoints[1];
    const cp2 = data.checkpoints[2];

    console.log(`CP0 (${cp0.name}): status=${cp0.status}, departedAt=${cp0.departureTime}`);
    console.log(`CP1 (${cp1.name}): status=${cp1.status}, departedAt=${cp1.departureTime}`);
    console.log(`CP2 (${cp2.name}): status=${cp2.status}, departedAt=${cp2.departureTime}`);

    if (cp0.status === 'passed' && cp1.status === 'passed' && cp2.status === 'upcoming') {
      console.log('--- Tracking Status Test Successful ---');
      process.exit(0);
    } else {
      console.error('--- Verification Failed: Statuses do not match expected values ---');
      process.exit(1);
    }

  } catch (error) {
    console.error('--- Tracking Status Test Failed ---');
    if (error.response) {
      console.error('Error Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testTracking();

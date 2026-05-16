const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

const testLocation = async () => {
  try {
    console.log('--- Starting Location Logic Test ---');

    console.log('Step 1: Setting up environment (Admin/Driver/Route/Bus)...');
    
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

    // 3. Create Route (Checkpoint at [77.6, 13.0])
    const routeRes = await axios.post(`${API_URL}/routes`, {
      name: 'Test Route',
      checkpoints: [
        { order: 1, name: 'Main Point', location: { coordinates: [77.6, 13.0] } }
      ],
      estimatedTime: 10,
      polyline: 'test_polyline'
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const routeId = routeRes.data._id;

    // 4. Create Active Bus
    const busRes = await axios.post(`${API_URL}/buses`, {
      registrationNo: `TEST-BUS-${Date.now()}`.slice(0, 15),
      capacity: 30,
      routeId: routeId,
      driverId: driverId
    }, { headers: { Authorization: `Bearer ${adminToken}` } });
    const busId = busRes.data._id;
    
    // Mark bus active manually for the test
    await axios.put(`${API_URL}/buses/${busId}`, { isActive: true }, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    console.log('Setup Complete.');

    // --- Start GPS Simulations ---

    // Transition 1: FAR
    console.log('Transition 1: Updating location FAR from checkpoint...');
    await axios.post(`${API_URL}/location`, { busId, lat: 12.0, lng: 77.0 }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    let status = (await axios.get(`${API_URL}/buses`)).data.find(b => b._id === busId);
    console.log('  State:', { arrived: status.arrivedAtCheckpoint, lastDeparted: status.lastDepartedCheckpointIndex });

    // Transition 2: ARRIVAL (within 50m)
    console.log('Transition 2: Updating location NEAR checkpoint (within 50m)...');
    await axios.post(`${API_URL}/location`, { busId, lat: 13.0001, lng: 77.6001 }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    status = (await axios.get(`${API_URL}/buses`)).data.find(b => b._id === busId);
    console.log('  State:', { arrived: status.arrivedAtCheckpoint, lastDeparted: status.lastDepartedCheckpointIndex });
    if (!status.arrivedAtCheckpoint) throw new Error('Failed to detect Arrival');

    // Transition 3: DEPARTURE (outside 100m)
    console.log('Transition 3: Updating location BEYOND checkpoint (outside 100m)...');
    await axios.post(`${API_URL}/location`, { busId, lat: 13.0015, lng: 77.6015 }, {
      headers: { Authorization: `Bearer ${driverToken}` }
    });
    status = (await axios.get(`${API_URL}/buses`)).data.find(b => b._id === busId);
    console.log('  State:', { arrived: status.arrivedAtCheckpoint, lastDeparted: status.lastDepartedCheckpointIndex });
    if (status.arrivedAtCheckpoint || status.lastDepartedCheckpointIndex !== 0) throw new Error('Failed to detect Departure');

    console.log('--- Location Logic Test Successful ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Location Logic Test Failed ---');
    if (error.response) {
      console.error('Error Response:', error.response.data);
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testLocation();

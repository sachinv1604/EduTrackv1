const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const testAttendanceAlerts = async () => {
  try {
    console.log('--- Starting Attendance & Alerts Test ---');

    // 1. Create Driver, Student, and Coordinator
    const timestamp = Date.now();
    
    console.log('Step 1: Creating Users...');
    const driverData = {
      name: 'Test Driver',
      email: `driver${timestamp}@example.com`,
      phone: `1${timestamp.toString().slice(-9)}`,
      role: 'driver',
      password: 'password123',
      collegeId: 'DRV123'
    };
    const studentData = {
      name: 'Test Student',
      email: `student${timestamp}@example.com`,
      phone: `2${timestamp.toString().slice(-9)}`,
      role: 'student',
      password: 'password123',
      collegeId: 'STU123'
    };
    const coordData = {
      name: 'Test Coordinator',
      email: `coord${timestamp}@example.com`,
      phone: `3${timestamp.toString().slice(-9)}`,
      role: 'coordinator',
      password: 'password123',
      collegeId: 'CRD123'
    };

    const dRes = await axios.post(`${BASE_URL}/auth/register`, driverData);
    const sRes = await axios.post(`${BASE_URL}/auth/register`, studentData);
    const cRes = await axios.post(`${BASE_URL}/auth/register`, coordData);

    const driverToken = dRes.data.token;
    const studentToken = sRes.data.token;
    const coordToken = cRes.data.token;
    const studentId = sRes.data._id;

    console.log('Users created successfully.');

    // 2. Create Route and Bus (using Coord token)
    console.log('Step 2: Creating Route and Bus...');
    const routeRes = await axios.post(`${BASE_URL}/routes`, {
      name: `Test Route ${timestamp}`,
      estimatedTime: 30,
      polyline: 'encoded_polyline_placeholder',
      checkpoints: [
        { order: 1, name: 'A', location: { type: 'Point', coordinates: [77.1, 28.1] } },
        { order: 2, name: 'B', location: { type: 'Point', coordinates: [77.2, 28.2] } }
      ]
    }, { headers: { Authorization: `Bearer ${coordToken}` } });

    const routeId = routeRes.data._id;

    const busRes = await axios.post(`${BASE_URL}/buses`, {
      registrationNo: `BUS-${timestamp.toString().slice(-4)}`,
      capacity: 40,
      routeId: routeId,
      driverId: dRes.data._id
    }, { headers: { Authorization: `Bearer ${coordToken}` } });

    const busId = busRes.data._id;
    console.log('Route and Bus created.');

    // 3. Mark Attendance (as Driver)
    console.log('Step 3: Marking Attendance (Driver)...');
    const attRes = await axios.post(`${BASE_URL}/attendance`, {
      busId: busId,
      studentId: studentId,
      date: new Date().toISOString(),
      status: 'present'
    }, { headers: { Authorization: `Bearer ${driverToken}` } });
    console.log('Attendance marked:', attRes.data.success);

    // 4. Get Report (as Coordinator)
    console.log('Step 4: Fetching Attendance Report (Coordinator)...');
    const reportRes = await axios.get(`${BASE_URL}/attendance/report`, {
      headers: { Authorization: `Bearer ${coordToken}` }
    });
    console.log('Report fetched, records found:', reportRes.data.count);

    // 5. Create Alert (as Student)
    console.log('Step 5: Creating Alert (Student)...');
    const alertRes = await axios.post(`${BASE_URL}/alerts`, {
      type: 'emergency',
      description: 'Medical emergency on bus',
      busId: busId,
      location: { coordinates: [77.15, 28.15] }
    }, { headers: { Authorization: `Bearer ${studentToken}` } });
    console.log('Alert created:', alertRes.data.success);
    const alertId = alertRes.data.data._id;

    // 6. List Alerts (as Coordinator)
    console.log('Step 6: Listing Alerts (Coordinator)...');
    const listAlertsRes = await axios.get(`${BASE_URL}/alerts`, {
      headers: { Authorization: `Bearer ${coordToken}` }
    });
    console.log('Alerts listed, found:', listAlertsRes.data.count);

    // 7. Resolve Alert (as Coordinator)
    console.log('Step 7: Resolving Alert (Coordinator)...');
    const resolveRes = await axios.put(`${BASE_URL}/alerts/${alertId}/resolve`, {}, {
      headers: { Authorization: `Bearer ${coordToken}` }
    });
    console.log('Alert resolved:', resolveRes.data.data.resolvedStatus);

    console.log('--- All Tests Passed Successfully ---');
    process.exit(0);
  } catch (error) {
    console.error('--- Test Failed ---');
    if (error.response) {
      console.error('Error Response:', JSON.stringify(error.response.data, null, 2));
    } else {
      console.error('Error:', error.message);
    }
    process.exit(1);
  }
};

testAttendanceAlerts();

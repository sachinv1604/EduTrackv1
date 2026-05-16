const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const Route = require('../src/models/Route');
const CheckpointLog = require('../src/models/CheckpointLog');
const { updateLocation } = require('../src/controllers/locationController');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

/**
 * MOCK REQUEST/RESPONSE HELPERS
 */
const mockRes = () => {
  const res = {};
  res.status = (code) => { res.statusCode = code; return res; };
  res.json = (data) => { res.data = data; return res; };
  return res;
};

async function verifyTracking() {
  try {
    console.log('--- STARTING TRACKING ENGINE VERIFICATION ---');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to Database.');

    // 1. SETUP: Find a route and reset it for testing
    let route = await Route.findOne({ name: 'UT-VERIFY' }); // Use a dedicated test name
    if (route) await Route.deleteOne({ _id: route._id });
    
    route = await Route.create({
      name: 'UT-VERIFY',
      registrationNo: 'VERIFY-B-001',
      estimatedTime: 45,
      isActive: true,
      setupMode: false,
      checkpoints: [
        { order: 0, name: 'Hubli CBT', location: { type: 'Point', coordinates: [75.1245, 15.3501] } },
        { order: 1, name: 'Unkal Lake', location: { type: 'Point', coordinates: [75.1325, 15.3715] } },
        { order: 2, name: 'Vidyanagar', location: { type: 'Point', coordinates: [75.1450, 15.3850] } }
      ]
    });

    console.log(`Route Created with ${route.checkpoints.length} checkpoints.`);

    // Reset Route State for "Trip Start"
    route.isActive = true;
    route.setupMode = false;
    route.lastDepartedCheckpointIndex = -1;
    route.arrivedAtCheckpoint = false;
    route.nextCheckpointETA = 0;
    route.nextCheckpointDistance = 0;
    await route.save();
    console.log('Route State Reset: [Start at Hubli CBT]');

    // Mock Driver
    const mockUser = { _id: route.driverId || new mongoose.Types.ObjectId(), name: 'Test Driver', role: 'driver' };
    if (!route.driverId) { route.driverId = mockUser._id; await route.save(); }

    /**
     * TEST CASE 1: ARRIVAL AT HUBBLI CBT
     * Stop Coordinates: [75.1245, 15.3501]
     * Mock Coords: Within 50m of CBT
     */
    console.log('\n[TEST 1] Testing Arrival at Hubli CBT...');
    const req1 = {
      body: { busId: route._id, lat: 15.3501, lng: 75.1245 },
      user: mockUser
    };
    const res1 = mockRes();
    await updateLocation(req1, res1);
    
    route = await Route.findById(route._id);
    console.log(`Status: ${res1.statusCode} | Arrived: ${route.arrivedAtCheckpoint} | Index: ${route.lastDepartedCheckpointIndex}`);
    if (route.arrivedAtCheckpoint === true) {
      console.log('✅ TEST 1 PASSED: Arrived at Stop 0');
    } else {
      console.error('❌ TEST 1 FAILED: Did not mark arrival');
    }

    /**
     * TEST CASE 2: DEPARTURE FROM HUBBLI CBT
     * Mock Coords: 100m away from CBT
     */
    console.log('\n[TEST 2] Testing Departure from Hubli CBT...');
    const req2 = {
      body: { busId: route._id, lat: 15.3510, lng: 75.1245 }, // roughly 100m north
      user: mockUser
    };
    const res2 = mockRes();
    await updateLocation(req2, res2);
    
    route = await Route.findById(route._id);
    console.log(`Status: ${res2.statusCode} | Arrived: ${route.arrivedAtCheckpoint} | Departed Index: ${route.lastDepartedCheckpointIndex}`);
    if (route.arrivedAtCheckpoint === false && route.lastDepartedCheckpointIndex === 0) {
      console.log('✅ TEST 2 PASSED: Departed Stop 0');
    } else {
      console.error('❌ TEST 2 FAILED: Did not mark departure');
    }

    /**
     * TEST CASE 3: ETA CALCULATION FOR UNKAL LAKE
     * Store 2 Coords: [75.1325, 15.3715]
     * Mock Coords: 1km away from Unkal Lake
     */
    console.log('\n[TEST 3] Testing ETA for Unkal Lake...');
    const req3 = {
      body: { busId: route._id, lat: 15.3615, lng: 75.1325 }, // roughly 1km south of Stop 1
      user: mockUser
    };
    const res3 = mockRes();
    await updateLocation(req3, res3);
    
    route = await Route.findById(route._id);
    console.log(`ETA: ${route.nextCheckpointETA} mins | Dist: ${route.nextCheckpointDistance}m`);
    if (route.nextCheckpointETA > 0 && route.nextCheckpointDistance > 0) {
      console.log('✅ TEST 3 PASSED: ETA calculated correctly');
    } else {
      console.error('❌ TEST 3 FAILED: ETA calc failed');
    }

    /**
     * TEST CASE 4: SEQUENCE BREAKTHROUGH (SKIP STOP 1)
     * Stop 2 Coords: [75.1450, 15.3850]
     * Mock Coords: Arrive at Stop 2 while server thinks we skipped Stop 1
     */
    console.log('\n[TEST 4] Testing Breakthrough (Skip Stop 1 -> Arrive at Stop 2)...');
    const req4 = {
      body: { busId: route._id, lat: 15.3850, lng: 75.1450 },
      user: mockUser
    };
    const res4 = mockRes();
    await updateLocation(req4, res4);
    
    route = await Route.findById(route._id);
    console.log(`Arrived: ${route.arrivedAtCheckpoint} at Index: ${route.lastDepartedCheckpointIndex + 1}`);
    if (route.arrivedAtCheckpoint === true && (route.lastDepartedCheckpointIndex + 1) === 2) {
      console.log('✅ TEST 4 PASSED: Breakthrough caught up to Stop 2');
    } else {
      console.error('❌ TEST 4 FAILED: Breakthrough logic failed');
    }

    /**
     * TEST CASE 5: TRIPLE-STOP CLUSTER (Same Location Testing)
     * All stops at the same spot. Server should jump to the last one.
     */
    console.log('\n[TEST 5] Testing Triple-Stop Cluster (Same Spot)...');
    route.checkpoints = [
      { order: 0, name: 'Home 1', location: { type: 'Point', coordinates: [0, 0] } },
      { order: 1, name: 'Home 2', location: { type: 'Point', coordinates: [0, 0] } },
      { order: 2, name: 'Home 3', location: { type: 'Point', coordinates: [0, 0] } }
    ];
    route.lastDepartedCheckpointIndex = -1;
    route.arrivedAtCheckpoint = false;
    await route.save();

    const req5 = {
      body: { busId: route._id, lat: 0, lng: 0 },
      user: mockUser
    };
    const res5 = mockRes();
    await updateLocation(req5, res5);
    
    route = await Route.findById(route._id);
    console.log(`Arrived: ${route.arrivedAtCheckpoint} | Index: ${route.lastDepartedCheckpointIndex + 1}`);
    if (route.arrivedAtCheckpoint === true && (route.lastDepartedCheckpointIndex + 1) === 2) {
      console.log('✅ TEST 5 PASSED: Cluster Breakthrough succeeded!');
    } else {
      console.error('❌ TEST 5 FAILED: Got stuck in cluster');
    }

    console.log('\n--- VERIFICATION COMPLETE ---');
    process.exit(0);
  } catch (err) {
    console.error('VERIFICATION_CRASH:', err);
    process.exit(1);
  }
}

verifyTracking();

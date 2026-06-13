/**
 * Driver Dashboard Screen
 * 
 * This is the MISSION CONTROL for the driver.
 * It does two main things:
 * 1. LIVE TRACKING: Streams GPS coordinates to the server every 10s.
 * 2. SETUP MODE: Allows the driver to "Draw" the route by marking stops.
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  Alert,
  ActivityIndicator,
  Dimensions,
  TextInput
} from 'react-native';
import CheckpointProgressBar from '../components/CheckpointProgressBar';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import busService from '../services/busService';
import locationService from '../services/locationService';
import trackingService from '../services/trackingService';

const DriverDashboard = () => {
  // 2. STATE & CONTEXT
  const { logout, user } = useAuth();
  const [bus, setBus] = useState(null); // The assigned Bus/Route object
  const [status, setStatus] = useState(null); // Real-time feedback from server
  const [location, setLocation] = useState(null); // Local phone GPS data
  const [isTripActive, setIsTripActive] = useState(false); // Local "tracking active" flag
  const [isLoading, setIsLoading] = useState(true);
  const [isMarking, setIsMarking] = useState(false); // Loading state for "Mark Checkpoint"
  const [newCheckpointName, setNewCheckpointName] = useState(''); // Text input for setup
  const [dailyStartTime, setDailyStartTime] = useState(''); // Scheduled start time (HH:MM)

  /**
   * AUTH ERROR HANDLER
   * If the token expires (401), we forced-logout the user.
   */
  const handleAuthError = (error) => {
    const errorStr = error.toString();
    if (errorStr.includes('401') || errorStr.includes('Not authorized')) {
      stopIntervals();
      Alert.alert('Session Expired', 'Please login again.', [{ text: 'OK', onPress: logout }]);
    } else {
      Alert.alert('Error', errorStr);
    }
  };

  /**
   * GLOBAL TRACKING CONTROL
   * These functions bridge the UI to the Tracking Singleton Service.
   */
  const stopIntervals = () => {
    trackingService.stopTracking(); 
  };

  const startIntervals = (bus) => {
    const routeId = bus?._id;
    if (!routeId) return;

    // Start the global service
    trackingService.startTracking(
      routeId,
      (newStatus) => {
        // UI Callback: Keep the dashboard in sync with the server status
        if (newStatus) {
          setStatus(newStatus);
          // Auto trip end check: if the server reports the trip is no longer active
          if (newStatus.isActive === false) {
            setIsTripActive(false);
            stopIntervals();
            Alert.alert(
              'Trip Complete',
              'You have reached the final checkpoint. The trip has ended automatically.'
            );
          }
        } else {
          setStatus(null);
          setIsTripActive(false);
        }
      },
      (error) => {
        // Auth Callback: Handle token expiration
        handleAuthError(error);
      },
      (newLoc) => {
        // Location Callback: Sync the device's current position to the UI
        if (newLoc) setLocation(newLoc);
      }
    );
  };

  /**
   * START / END TRIP
   * Toggles the 'isActive' flag on the server.
   */
  const toggleTrip = async () => {
    if (!bus) {
      console.warn('[DRIVE] Toggle attempted without bus data.');
      return;
    }
    const newStatus = !isTripActive;
    
    // Check permissions before starting a trip
    if (newStatus) {
      const { fgGranted, bgGranted } = await locationService.requestPermissions();
      if (!fgGranted) {
        Alert.alert('Permission Denied', 'GPS is required to track the bus.');
        return;
      }
      if (!bgGranted) {
        Alert.alert(
          'Background Location Required',
          'To track the bus when the screen is locked, in a call, or minimized, please set Location Access to "Allow all the time" in your device settings.'
        );
        return;
      }
    }

    console.log(`[DRIVE] Requesting Trip Change: ${newStatus ? 'START' : 'END'}`);
    setIsLoading(true);

    try {
      // 1. Tell server to change trip state
      const response = await busService.toggleTrip(bus._id, newStatus);
      console.log(`[DRIVE] Server Response: SUCCESS. Trip is now ${response.isActive ? 'ACTIVE' : 'INACTIVE'}`);
      
      setBus(response); // Sync with server's fresh version of the route
      setIsTripActive(newStatus);
      
      if (newStatus) {
        // 2. Begin the background tracking loop
        startIntervals(bus);
      } else {
        // 3. Kill the loop
        stopIntervals();
        setStatus(null);
      }
    } catch (error) {
      console.error('[DRIVE_ERR] Toggle failed:', error);
      handleAuthError(error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * SETUP MODE: MARK CHECKPOINT
   * This handles the "Discovery" of new stops.
   */
  const handleAddCheckpoint = async () => {
    if (!bus) return;

    if (!newCheckpointName.trim()) {
      Alert.alert('Stop Name Required', 'Please enter a name for the stop before marking it.');
      return;
    }

    // GPS LOCK CHECK: Prevent saving [0,0] which causes the 8-million-meter bug.
    // Relaxed threshold for clicking (100m) but warn if > 50m
    const currentLoc = location || await locationService.getCurrentLocation();
    if (currentLoc) setLocation(currentLoc);

    if (!currentLoc || (currentLoc.latitude === 0 && currentLoc.longitude === 0)) {
      Alert.alert('GPS Not Ready', 'Wait for your coordinates to appear at the top (e.g. 15.36, 75.12) before marking stops.');
      return;
    }

    if (currentLoc.accuracy && currentLoc.accuracy > 50) {
      // If accuracy is between 51m and 100m, we ask for confirmation
      if (currentLoc.accuracy > 100) {
        Alert.alert('Weak GPS Signal', `Signal accuracy is too poor (${currentLoc.accuracy.toFixed(0)}m). Please wait for a better lock.`);
        return;
      }
      
      const proceed = await new Promise((resolve) => {
        Alert.alert(
          'Weak Signal', 
          `Signal accuracy is ${currentLoc.accuracy.toFixed(0)}m. This might cause tracking issues. Mark anyway?`,
          [
            { text: 'Wait', onPress: () => resolve(false), style: 'cancel' },
            { text: 'Mark Anyway', onPress: () => resolve(true) }
          ]
        );
      });
      if (!proceed) return;
    }

    setIsMarking(true);
    try {
      // Send STOP NAME and CURRENT GPS to server
      const response = await busService.addCheckpoint(
        bus._id, 
        newCheckpointName.trim(), 
        currentLoc.latitude, 
        currentLoc.longitude
      );

      // Refresh local state with the new list of stops
      if (response.route) {
        setBus(response.route);
        setStatus(prev => ({ ...prev, checkpoints: response.route.checkpoints }));
      }
      Alert.alert('Success', `"${newCheckpointName}" added.`);
      setNewCheckpointName('');
    } catch (error) {
      handleAuthError(error);
    } finally {
      setIsMarking(false);
    }
  };

  const handleMarkExistingCheckpoint = async (index, name) => {
    if (!bus) return;

    Alert.alert(
      'Update Stop Location',
      `Set current GPS as the location for "${name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Update Location', 
          onPress: async () => {
            try {
              setIsMarking(true);
              const currentLoc = await locationService.getCurrentLocation();
              if (currentLoc) setLocation(currentLoc);

              const response = await busService.markCheckpoint(
                bus._id,
                index,
                currentLoc.latitude,
                currentLoc.longitude
              );

              if (response.route) {
                setBus(response.route);
                setStatus(prev => ({ ...prev, checkpoints: response.route.checkpoints }));
              }
              Alert.alert('Success', `Location for "${name}" updated.`);
            } catch (error) {
              handleAuthError(error);
            } finally {
              setIsMarking(false);
            }
          }
        }
      ]
    );
  };

  const handleManualArrival = async () => {
    if (!bus || !isTripActive) return;

    Alert.alert(
      'Manual Arrival',
      'Force arrival at the next stop?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Arrive Now', 
          onPress: async () => {
            try {
              setIsLoading(true);
              const currentLoc = location || await locationService.getCurrentLocation();
              
              // Trigger a manual arrival call
              await busService.manualArrival(bus._id);
              
              // Refresh status immediately
              const newStatus = await trackingService.getBusStatus(bus._id);
              if (newStatus) setStatus(newStatus);
              
              Alert.alert('Success', 'Manual arrival recorded.');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to record manual arrival');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleDeleteCheckpoint = async (index) => {
    Alert.alert(
      'Delete Stop?',
      'Are you sure you want to remove this stop?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await busService.deleteCheckpoint(bus._id, index);
              // Refresh bus data
              const updatedBus = await busService.getMyBus();
              setBus(updatedBus);
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to delete stop');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleClearCheckpoints = async () => {
    Alert.alert(
      'Clear All Stops?',
      'This will wipe all existing stops and reset the route. Proceed?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear All', 
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await busService.clearCheckpoints(bus._id);
              // Refresh bus data
              const updatedBus = await busService.getMyBus();
              setBus(updatedBus);
              setNewCheckpointName('');
            } catch (err) {
              Alert.alert('Error', err.message || 'Failed to clear stops');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  /**
   * SETUP MODE: FINALIZE
   * Ends Setup Mode and enables automatic arrivals/departures.
   */
  const handleFinishSetup = async () => {
    if (!bus) return;
    Alert.alert(
      'Finish Setup?', 
      'This will enable automated stop detection.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Finish', 
          onPress: async () => {
            setIsLoading(true);
            try {
              const response = await busService.finishSetup(bus._id);
              if (response.route) setBus(response.route);
              Alert.alert('Setup Complete', 'Route is now automated!');
            } catch (error) {
              handleAuthError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleSaveStartTime = async () => {
    if (!bus) return;

    const formattedTime = dailyStartTime ? dailyStartTime.trim() : '';

    if (formattedTime !== '') {
      // Validate HH:MM format
      const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(formattedTime)) {
        Alert.alert('Invalid Format', 'Please enter time in HH:MM format (24-hour clock, e.g. 08:30 or 15:45).');
        return;
      }
    }

    setIsLoading(true);
    try {
      const response = await busService.updateStartTime(bus._id, formattedTime || null);
      setBus(response);
      Alert.alert('Success', 'Daily trip start time updated successfully.');
    } catch (error) {
      Alert.alert('Error', error.toString() || 'Failed to update schedule time');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * RESET CHECKPOINTS
   * Wipes all markers for this route so the driver can start from scratch.
   */
  const handleResetCheckpoints = async () => {
    if (!bus) return;
    Alert.alert(
      'Clear All Stops?',
      'This will delete every checkpoint you have marked for this route. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              // We use the new dedicated reset endpoint for drivers
              const response = await busService.resetCheckpoints(bus._id);
              setBus(response);
              setStatus(prev => ({ ...prev, checkpoints: [] }));
              Alert.alert('Reset Complete', 'You can now start marking stops from scratch.');
            } catch (error) {
              handleAuthError(error);
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  /**
   * INITIALIZATION
   * Runs when the driver logs in.
   */
  useEffect(() => {
    const init = async () => {
      // HARD RESET: Ensure no intervals are running before we start!
      stopIntervals();
      
      try {
        // 1. Check Permissions AND Enablement
        const { fgGranted, bgGranted } = await locationService.requestPermissions();
        const gpsEnabled = await locationService.checkLocationEnabled();
        
        if (!fgGranted) {
          Alert.alert('Permission Denied', 'Foreground GPS permission is required to track the bus.');
        } else if (!bgGranted) {
          Alert.alert(
            'Background Location Required',
            'To track the bus when the screen is locked, in a call, or minimized, please set Location Access to "Allow all the time" in your device settings.'
          );
        }
        
        if (!gpsEnabled) {
          Alert.alert('GPS Disabled', 'Please turn on location services in your phone settings.');
        }

        console.log('[INIT] Dashboard Bootup Complete.');
        
        // 2. Fetch the driver's assigned route
        const myBus = await busService.getMyBus();
        console.log(`[INIT] Assigned Route Found: ${myBus.name} (ID: ${myBus._id})`);
        setBus(myBus);
        if (myBus.dailyStartTime) {
          setDailyStartTime(myBus.dailyStartTime);
        }
        
        /**
         * MANUAL CONTROL RESTORATION:
         * We no longer automatically "resume" tracking even if the trip is 
         * active in the database. This gives the driver full control.
         * The UI will show the "Start" or "End" status based on the server state,
         * but the background interval will NOT start until a button click.
         */
        setIsTripActive(myBus.isActive);
        console.log(`[INIT] Server Trip Status: ${myBus.isActive ? 'ACTIVE (Resumed UI Only)' : 'INACTIVE'}`);

        // Fetch location once immediately to enable the UI buttons
        const loc = await locationService.getCurrentLocation();
        if (loc) setLocation(loc);

        // Removed: startIntervals(myBus) from here to prevent automatic start
      } catch (error) {
        console.error('[INIT_ERR] Startup failed:', error);
        handleAuthError(error);
      } finally {
        setIsLoading(false);
      }
    };
    init();

    // CLEANUP: Always stop tracking if this component dies
    return () => stopIntervals();
  }, []);

  if (isLoading && !bus) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
           <Text style={styles.welcomeText}>Welcome {user?.name || 'Driver'}</Text>
           <Text style={styles.registrationText}>{bus?.registrationNo || 'No Bus Assigned'}</Text>
           
           <View style={styles.gpsBadge}>
             <Text style={styles.gpsText}>
               🛰️ GPS: <Text style={styles.gpsHighlight}>
                 {location?.latitude ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}` : 'Locking...'}
               </Text>
             </Text>
             {location?.accuracy && (
               <Text style={[styles.accuracyText, location.accuracy > 50 ? styles.weakSignal : styles.strongSignal]}>
                 Accuracy: {location.accuracy.toFixed(0)}m ({location.accuracy > 50 ? 'Improving...' : 'Strong'})
               </Text>
             )}
           </View>
         </View>
         <TouchableOpacity onPress={logout} style={styles.logoutButton}>
           <Text style={styles.logoutText}>Logout</Text>
         </TouchableOpacity>
       </View>
 
       <ScrollView contentContainerStyle={styles.content}>
         {/* ROUTE PROGRESS BAR (Visible to Driver too for confirmation) */}
         <View style={styles.statusCard}>
           <View style={styles.cardHeader}>
             <Text style={styles.cardTitle}>Route Progress</Text>
             {bus?.setupMode && (
               <View style={styles.setupBadge}>
                 <Text style={styles.setupBadgeText}>SETUP MODE</Text>
               </View>
             )}
           </View>
           
           <CheckpointProgressBar 
              checkpoints={(bus?.checkpoints && bus.checkpoints.length > 0) ? bus.checkpoints : (status?.checkpoints || [])}
              currentCheckpointIndex={(status?.lastDepartedCheckpointIndex ?? -1) + 1}
              arrivedAtCheckpoint={status?.arrivedAtCheckpoint}
              nextCheckpointETA={status?.nextCheckpointETA}
              isActive={isTripActive}
            />

           {/* PROXIMITY DEBUG: Shows the driver how close they are to the next stop */}
           {isTripActive && status?.nextCheckpointDistance !== undefined && (
             <View style={styles.debugPanel}>
               <Text style={styles.debugText}>
                 {status?.arrivedAtCheckpoint ? "✅ Arrived at Stop" : "📍 Distance to Next Stop"}: <Text style={styles.debugHighlight}>{status.nextCheckpointDistance}m</Text>
               </Text>
               <Text style={styles.debugSubtext}>
                 {status?.arrivedAtCheckpoint ? "(Drive 50m away to depart)" : "(Must be under 50m to trigger arrival)"}
               </Text>
             </View>
           )}

           {/* TRIP INACTIVE WARNING */}
           {!isTripActive && (
             <View style={styles.inactiveStatusBadge}>
               <Text style={styles.inactiveStatusText}>⚠️ TRIP NOT STARTED. LOGGING DISABLED.</Text>
             </View>
           )}
         </View>
  
         {/**
          * SETUP ACTIONS PANEL
          * Only visible when the trip is active AND the route is in Setup Mode.
          */}
         {isTripActive && bus?.setupMode && (
          <View style={styles.setupActions}>
            <Text style={styles.setupTitle}>Initial Route Calibration</Text>
            <Text style={styles.setupDescription}>
              Arrive at a stop and click "Mark" to save it.
            </Text>
            
            <TextInput
              style={styles.textInput}
              placeholder="Stop Name (e.g. Block A)"
              placeholderTextColor={COLORS.textDim}
              value={newCheckpointName}
              onChangeText={setNewCheckpointName}
            />
            <TouchableOpacity 
              style={[styles.markButton, (!location || location.latitude === 0 || (location.accuracy && location.accuracy > 100)) && { opacity: 0.5 }]}
              onPress={handleAddCheckpoint}
              disabled={isMarking || !location || location.latitude === 0 || (location.accuracy && location.accuracy > 100)}
            >
              {isMarking ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.markButtonText}>Mark Current Stop</Text>}
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.finishButton, { marginTop: 12 }]}
              onPress={handleFinishSetup}
            >
              <Text style={styles.finishButtonText}>Finalize Route Stops</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.clearButton, { marginTop: 12 }]}
              onPress={handleClearCheckpoints}
            >
              <Text style={styles.clearButtonText}>Clear All Stops</Text>
            </TouchableOpacity>

            {/* List of current checkpoints in Setup Mode */}
            {bus?.checkpoints && bus.checkpoints.length > 0 && (
              <View style={styles.setupList}>
                <Text style={styles.setupListTitle}>Saved Stops:</Text>
                {bus.checkpoints.map((cp, idx) => (
                  <View key={idx} style={styles.setupListItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.setupListItemText}>{idx + 1}. {cp.name}</Text>
                      {cp.location?.coordinates?.[0] !== 0 && (
                        <Text style={{ fontSize: 8, color: COLORS.secondary }}>Fixed GPS Recorded</Text>
                      )}
                    </View>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <TouchableOpacity onPress={() => handleMarkExistingCheckpoint(idx, cp.name)}>
                        <Text style={styles.markLink}>Mark</Text>
                      </TouchableOpacity>
                      <TouchableOpacity onPress={() => handleDeleteCheckpoint(idx)}>
                        <Text style={styles.deleteLink}>Remove</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

         {/* DAILY SCHEDULE CARD */}
         <View style={styles.card}>
           <Text style={styles.cardLabel}>Daily Schedule</Text>
           <Text style={styles.scheduleDescription}>
             Set your daily scheduled trip start time. Reminders will be sent 15m, 10m, and 5m before this time.
           </Text>
           <View style={styles.timeInputContainer}>
             <TextInput
               style={styles.textInputInline}
               placeholder="HH:MM (e.g. 08:30)"
               placeholderTextColor={COLORS.textDim}
               value={dailyStartTime}
               onChangeText={setDailyStartTime}
               maxLength={5}
             />
             <TouchableOpacity 
               style={styles.saveTimeButton}
               onPress={handleSaveStartTime}
               disabled={isLoading}
             >
               <Text style={styles.saveTimeButtonText}>Save Time</Text>
             </TouchableOpacity>
           </View>
         </View>

         {/* TRIP CONTROL CARD */}
         <View style={[styles.card, isTripActive && styles.activeCard]}>
           <Text style={styles.cardLabel}>Trip Info</Text>
           <Text style={styles.busInfo}>Bus: {bus?.registrationNo || 'N/A'}</Text>
           <Text style={styles.routeInfo}>Route: {bus?.name || 'Calculated'}</Text>
           
           <View style={styles.divider} />
          
          <TouchableOpacity 
            style={[styles.tripButton, isTripActive ? styles.endTripButton : styles.startTripButton]}
            onPress={toggleTrip}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.buttonText}>{isTripActive ? 'End Trip' : 'Start Trip'}</Text>
            )}
          </TouchableOpacity>

          {isTripActive && !bus?.setupMode && (
            <TouchableOpacity 
              style={[styles.manualButton, { backgroundColor: 'rgba(52, 211, 153, 0.15)', borderColor: COLORS.secondary }]}
              onPress={handleManualArrival}
              disabled={isLoading}
            >
              <Text style={[styles.manualButtonText, { color: COLORS.secondary }]}>Mark Arrival at Stop (Manual)</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    marginTop: 10,
  },
  welcomeText: {
    color: COLORS.textDim,
    fontSize: 14,
  },
  registrationText: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
  },
  emptySubtitle: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  completionBadge: {
    marginTop: 20,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    alignItems: 'center',
  },
  completionText: {
    color: COLORS.secondary,
    fontWeight: 'bold',
    fontSize: 14,
    letterSpacing: 1,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.surface,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
  },
  inactiveStatusBadge: {
    marginTop: 15,
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    alignItems: 'center',
  },
  inactiveStatusText: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  content: {
    padding: 20,
  },
  gpsBadge: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 10,
    alignSelf: 'flex-start',
  },
  gpsText: {
    color: '#AAA',
    fontSize: 10,
    fontWeight: '600',
  },
  gpsHighlight: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  accuracyText: {
    fontSize: 10,
    marginTop: 4,
    fontWeight: 'bold',
  },
  weakSignal: {
    color: COLORS.error,
  },
  strongSignal: {
    color: COLORS.secondary,
  },
  manualButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  manualButtonText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: 'bold',
  },
  statusCard: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeCard: {
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  cardTitle: {
    color: COLORS.primary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  setupBadge: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  setupBadgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  cardLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
    letterSpacing: 1,
  },
  busInfo: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  routeInfo: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 15,
  },
  setupActions: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    padding: 24,
    borderRadius: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  setupTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  setupDescription: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 20,
  },
  checkpointName: {
    color: COLORS.secondary,
    fontWeight: 'bold',
    fontSize: 18,
  },
  markButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  markButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  textInput: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  finishButton: {
    backgroundColor: COLORS.secondary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  finishButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  tripButton: {
    padding: 18,
    borderRadius: 16,
    alignItems: 'center',
  },
  startTripButton: {
    backgroundColor: COLORS.secondary,
  },
  endTripButton: {
    backgroundColor: COLORS.error,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 18,
  },
  hint: {
    textAlign: 'center',
    color: COLORS.textDim,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 10,
  },
  resetButton: {
    marginTop: 20,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(231, 76, 60, 0.2)',
    borderRadius: 12,
  },
  resetButtonText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  debugPanel: {
    backgroundColor: 'rgba(52, 211, 153, 0.05)',
    padding: 15,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.2)',
    marginTop: 20,
    alignItems: 'center',
  },
  debugText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: 'bold',
  },
  debugHighlight: {
    color: COLORS.secondary,
    fontWeight: '900',
  },
  debugSubtext: {
    color: COLORS.textDim,
    fontSize: 10,
    marginTop: 4,
    fontStyle: 'italic',
  },
  clearButton: {
    padding: 15,
    backgroundColor: 'transparent',
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  clearButtonText: {
    color: COLORS.error,
    fontWeight: 'bold',
  },
  setupList: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
  },
  setupListTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  setupListItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  setupListItemText: {
    color: COLORS.textDim,
  },
  deleteLink: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: 'bold',
  },
  markLink: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 15,
  },
  scheduleDescription: {
    color: COLORS.textDim,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 15,
  },
  timeInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textInputInline: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    marginRight: 10,
  },
  saveTimeButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveTimeButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 14,
  },
});

export default DriverDashboard;

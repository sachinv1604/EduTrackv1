/**
 * Student Dashboard Screen
 * 
 * This is the "Watching" screen for students. 
 * Its main job is to show the progress of the bus on a progress bar.
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  Dimensions,
  Alert,
  Linking,
  RefreshControl
} from 'react-native';
import CheckpointProgressBar from '../components/CheckpointProgressBar';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import trackingService from '../services/trackingService';
import userService from '../services/userService';
import noticeService from '../services/noticeService';

const StudentDashboard = () => {
  // 1. STATE & CONTEXT
  const { logout, user } = useAuth(); // Get user info and logout function from Context
  const [status, setStatus] = useState(null); // Real-time bus status (checkpoints, isActive)
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [route, setRoute] = useState(null); // The basic route ID or info
  
  // 2. POLLING REFERENCE
  // useRef is used here to store the ID of the "setInterval" 
  // so we can stop it when the user leaves the screen.
  const statusInterval = useRef(null);

  /**
   * FETCH LIVE STATUS
   * Calls the tracking service to get the latest bus progress.
   */
  const fetchLiveStatus = async (id) => {
    try {
      const liveStatus = await trackingService.getBusStatus(id);
      setStatus(liveStatus); // Update the UI with new data
    } catch (err) {
      console.log('[Student] Status update skipped');
    }
  };

  /**
   * INITIAL DATA LOAD
   * 1. Fetches the user's full profile to find their assigned route.
   * 2. Starts the "Polling" interval (updates every 10 seconds).
   */
  const fetchInitialData = async () => {
    setIsLoading(true);
    try {
      // Get the freshest profile data from the server
      const profile = await userService.getMe();
      const routeId = profile?.assignedRoute || profile?.requestedRoute;
      
      if (routeId) {
        setRoute({ _id: routeId });
        await fetchLiveStatus(routeId); // Fetch once immediately
        
        // REPEAT every 6 seconds (Polling, optimized in v3)
        if (statusInterval.current) clearInterval(statusInterval.current);
        statusInterval.current = setInterval(() => {
          fetchLiveStatus(routeId);
        }, 6000);
      }
    } catch (err) {
      console.log('[Student] Fetch error:', err);
      // Fallback: If network is slow, try using the info stored in AuthContext
      if (user?.assignedRoute) {
        const rId = user.assignedRoute;
        setRoute({ _id: rId });
        fetchLiveStatus(rId);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const profile = await userService.getMe();
      const routeId = profile?.assignedRoute || profile?.requestedRoute;
      
      if (routeId) {
        setRoute({ _id: routeId });
        await fetchLiveStatus(routeId);
        
        // Reset interval to align with manual refresh
        if (statusInterval.current) clearInterval(statusInterval.current);
        statusInterval.current = setInterval(() => {
          fetchLiveStatus(routeId);
        }, 6000);
      }
    } catch (err) {
      console.log('[Student] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, [user]);

  /**
   * LIFECYCLE: Mounting & Unmounting
   * Runs once when the screen opens.
   */
  useEffect(() => {
    fetchInitialData();

    // CLEANUP: If the user leaves the screen, STOP the interval 
    // so we don't waste battery/data.
    return () => {
      if (statusInterval.current) clearInterval(statusInterval.current);
    };
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  const handleShowNotices = async () => {
    try {
      const notices = await noticeService.getNotices();
      if (notices && notices.length > 0) {
        const noticesText = notices.map(n => `${n.title}\n${n.content}`).join('\n\n');
        Alert.alert('Notices', noticesText);
      } else {
        Alert.alert('Notices', 'No new notices.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to fetch notices.');
    }
  };

  const handleCallCoordinator = async () => {
    const phoneNumber = status?.coordinatorPhone;
    if (phoneNumber) {
      const url = `tel:${phoneNumber}`;
      try {
        await Linking.openURL(url);
      } catch (err) {
        Alert.alert(
          'Unable to Call',
          `Could not open the dialer automatically. The coordinator's phone number is: ${phoneNumber}`
        );
      }
    } else {
      Alert.alert('Unavailable', 'Coordinator phone number not found.');
    }
  };

  const isBusActive = status?.isActive; // Check if the trip has started

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER SECTION */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>Hello, {user?.name}</Text>
          <Text style={styles.title}>Your Route</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={COLORS.primary}
            colors={[COLORS.primary]}
          />
        }
      >
        {/* PROGRESS CARD */}
        <View style={[styles.card, isBusActive && styles.activeCard]}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Live Status</Text>
            {/* Status Badge: Changes color if bus is active */}
            <View style={[styles.badge, { backgroundColor: isBusActive ? COLORS.secondary : COLORS.textDim }]}>
              <Text style={styles.badgeText}>{isBusActive ? 'TRIP ACTIVE' : 'OFFLINE'}</Text>
            </View>
          </View>

          <View>
            {isBusActive ? (
              <View>
                <Text style={styles.statusMain}>
                  {status?.registrationNo || 'Bus On Route'}
                </Text>
                <Text style={styles.statusSub}>Route: {status?.routeName || 'N/A'}</Text>
              </View>
            ) : null}

            {/* THE PROGRESS BAR
                This component draws the dots and lines for the stops. */}
            <View style={styles.progressContainer}>
              <CheckpointProgressBar 
                checkpoints={status?.checkpoints || route?.checkpoints || []}
                currentCheckpointIndex={(status?.lastDepartedCheckpointIndex ?? -1) + 1}
                arrivedAtCheckpoint={status?.arrivedAtCheckpoint}
                nextCheckpointETA={status?.nextCheckpointETA}
                isActive={isBusActive}
              />
            </View>

            {isBusActive && status?.nextCheckpointDistance !== undefined && (
              <View style={styles.distancePanel}>
                <Text style={styles.distanceText}>
                  {status?.arrivedAtCheckpoint ? "✅ Arrived at Stop" : "📍 Distance to Next Stop"}: <Text style={styles.distanceHighlight}>{status.nextCheckpointDistance}m</Text>
                </Text>
              </View>
            )}

            {/* OFFLINE MESSAGE
                Shown when the driver hasn't started the trip yet. */}
            {!isBusActive && (
              <View style={styles.offlineContainer}>
                <Text style={styles.offlineText}>
                  {status?.setupMode ? 'Route is currently in setup mode.' : 'The bus is currently offline. Tracking will begin once the driver starts the trip.'}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* QUICK MENU */}
        <View style={styles.grid}>
          <TouchableOpacity style={styles.menuItem} onPress={handleShowNotices}>
            <Text style={styles.menuIcon}>📢</Text>
            <Text style={styles.menuText}>Notices</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.menuItem} onPress={handleCallCoordinator}>
            <Text style={styles.menuIcon}>📞</Text>
            <Text style={styles.menuText}>Call Coordinator</Text>
          </TouchableOpacity>
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
    padding: 24,
    marginTop: 10,
  },
  welcome: {
    color: COLORS.textDim,
    fontSize: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.surface,
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 28,
    borderRadius: 32,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeCard: {
    borderColor: 'rgba(52, 211, 153, 0.2)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cardTitle: {
    color: COLORS.primary,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  statusMain: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statusSub: {
    color: COLORS.secondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 24,
  },
  progressContainer: {
    marginTop: 10,
  },
  distancePanel: {
    marginTop: 15,
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(52, 211, 153, 0.3)',
  },
  distanceText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: '600',
  },
  distanceHighlight: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  offlineContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  offlineIcon: {
    fontSize: 48,
    marginBottom: 16,
    opacity: 0.5,
  },
  offlineText: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  grid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  menuItem: {
    width: '48%',
    backgroundColor: COLORS.surface,
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.03)',
  },
  menuIcon: {
    fontSize: 28,
    marginBottom: 10,
  },
  menuText: {
    color: COLORS.text,
    fontWeight: '700',
    fontSize: 13,
  },
});

export default StudentDashboard;

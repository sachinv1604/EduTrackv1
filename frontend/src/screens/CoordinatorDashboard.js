/**
 * Coordinator Dashboard Screen
 * 
 * This is a multi-functional hub. Coordinators can:
 * 1. Tracking: Monitor their assigned bus.
 * 2. Students: See who is on their bus.
 * 3. Broadcast: Send push notifications to their route.
 * 4. Approvals: Approve new students joining the route.
 */
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  FlatList,
  TextInput,
  Alert,
  ActivityIndicator,
  Dimensions,
  Linking,
  RefreshControl
} from 'react-native';
import CheckpointProgressBar from '../components/CheckpointProgressBar';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import busService from '../services/busService';
import userService from '../services/userService';
import trackingService from '../services/trackingService';
import noticeService from '../services/noticeService';

const CoordinatorDashboard = () => {
  // 1. STATE MANAGEMENT
  const { logout, user } = useAuth();
  const [activeTab, setActiveTab] = useState('bus'); // Controls which sub-screen is visible
  const [bus, setBus] = useState(null); // The physical bus/route info
  const busRef = useRef(null); // Ref to avoid React stale closure bug in polling
  const [students, setStudents] = useState([]); // List of approved students
  const [pendingStudents, setPendingStudents] = useState([]); // List of students waiting for approval
  const [status, setStatus] = useState(null); // Real-time GPS status of the bus
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [approving, setApproving] = useState(null); // ID of student currently being approved

  // NOTICE FORM STATE
  const [noticeTitle, setNoticeTitle] = useState('');
  const [noticeContent, setNoticeContent] = useState('');
  const [targetRoles, setTargetRoles] = useState(['student']); 

  /**
   * DATA FETCHING (The "Big Refresh")
   * Combines data from 4 different API endpoints to populate the dashboard.
   */
  const fetchData = async () => {
    setIsLoading(true);
    try {
      // 1. Get assigned bus
      const buses = await busService.getCoordinatorBuses();
      const myBus = Array.isArray(buses) ? buses[0] : buses;
      setBus(myBus); 
      busRef.current = myBus;
      
      // 2. Get approved students for this route
      const studentsData = await userService.getRouteStudents();
      setStudents(studentsData);

      // 3. Get students waiting for approval
      const pendingData = await userService.getPendingApprovals();
      setPendingStudents(pendingData);
      
      // 4. Get initial tracking status
      if (myBus) {
        try {
          const routeId = myBus.routeId?._id || myBus.routeId || myBus._id;
          const busStatus = await trackingService.getBusStatus(routeId);
          setStatus(busStatus);
        } catch (sErr) {
          console.log('[Coordinator] Status fetch skip:', sErr);
        }
      }
    } catch (err) {
      console.log('[Coordinator] Fetch info error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      // 1. Get assigned bus
      const buses = await busService.getCoordinatorBuses();
      const myBus = Array.isArray(buses) ? buses[0] : buses;
      setBus(myBus);
      busRef.current = myBus;
      
      // 2. Get approved students for this route
      const studentsData = await userService.getRouteStudents();
      setStudents(studentsData);

      // 3. Get students waiting for approval
      const pendingData = await userService.getPendingApprovals();
      setPendingStudents(pendingData);
      
      // 4. Get initial tracking status
      if (myBus) {
        try {
          const routeId = myBus.routeId?._id || myBus.routeId || myBus._id;
          const busStatus = await trackingService.getBusStatus(routeId);
          setStatus(busStatus);
        } catch (sErr) {
          console.log('[Coordinator] Status fetch skip:', sErr);
        }
      }
    } catch (err) {
      console.log('[Coordinator] Refresh error:', err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  /**
   * LIVE STATUS POLLING
   * Updates only the tracking data every 8 seconds.
   */
  const fetchBusStatus = async () => {
    const currentBus = busRef.current;
    if (!currentBus) return;
    try {
      const routeId = currentBus.routeId?._id || currentBus.routeId || currentBus._id;
      const busStatus = await trackingService.getBusStatus(routeId);
      setStatus(busStatus);
    } catch (error) {
      console.error('[Coordinator] Tracking update error:', error);
    }
  };

  // Run initialization on mount
  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchBusStatus, 8000);
    return () => clearInterval(interval); // Cleanup polling on exit
  }, []);

  /**
   * BROADCAST NOTICE
   * Sends a message to the route's residents (students/drivers).
   */
  const handleSendNotice = async () => {
    if (!noticeTitle || !noticeContent) {
      Alert.alert('Missing Info', 'Please provide a title and content.');
      return;
    }

    setIsLoading(true);
    try {
      await noticeService.createNotice({
        title: noticeTitle,
        content: noticeContent,
        targetRoles: JSON.stringify(targetRoles),
        targetRoutes: JSON.stringify([bus?._id]) // Restricted to THIS coordinator's bus
      });
      Alert.alert('Success', 'Notice broadcasted via Push Notification!');
      setNoticeTitle('');
      setNoticeContent('');
    } catch (error) {
      Alert.alert('Notice Failed', error.toString());
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * APPROVE STUDENT
   * Moving a student from "Pending" to "Approved".
   */
  const handleApprove = async (userId) => {
    setApproving(userId);
    try {
      await userService.approveUser(userId);
      Alert.alert('Approved', 'Student has been added to the route.');
      fetchData(); // Refresh lists
    } catch (err) {
      Alert.alert('Error', err.toString());
    } finally {
      setApproving(null);
    }
  };

  /**
   * TAB 1: BUS TRACKING
   * Shows the progress bar and driver contact info.
   */
  const renderBusTab = () => (
    <ScrollView 
      style={styles.tabContent}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={COLORS.primary}
          colors={[COLORS.primary]}
        />
      }
    >
      {!bus ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🚌</Text>
          <Text style={styles.emptyTitle}>No Bus Assigned</Text>
          <Text style={styles.emptySubtitle}>
            Contact Admin to link your account to a specific route.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.trackingCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Live Tracking</Text>
              <View style={[styles.badge, { backgroundColor: status?.isActive ? COLORS.secondary : COLORS.textDim }]}>
                <Text style={styles.badgeText}>{status?.isActive ? 'ACTIVE' : 'OFFLINE'}</Text>
              </View>
            </View>
            
            <CheckpointProgressBar 
              checkpoints={status?.checkpoints || bus?.routeId?.checkpoints || bus?.checkpoints || []}
              currentCheckpointIndex={(status?.lastDepartedCheckpointIndex ?? -1) + 1}
              arrivedAtCheckpoint={status?.arrivedAtCheckpoint}
            />

            {!status?.isActive && (
              <View style={styles.offlineBox}>
                <Text style={styles.offlineText}>
                  {status?.setupMode ? 'Route is currently in setup mode.' : 'Bus is currently offline.'}
                </Text>
              </View>
            )}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardLabel}>Assigned Bus</Text>
            <Text style={styles.cardValue}>{bus?.registrationNo || 'N/A'}</Text>
            <Text style={styles.cardSubValue}>Route: {bus?.routeId?.name || bus?.name || 'N/A'}</Text>
            
            <View style={styles.divider} />
            
            <Text style={styles.cardLabel}>Driver Detail</Text>
            <Text style={styles.cardValue}>{bus?.driverId?.name || 'Unknown'}</Text>
            {bus?.driverId?.phone && (
              <TouchableOpacity onPress={() => Linking.openURL(`tel:${bus.driverId.phone}`)}>
                <Text style={styles.phoneLink}>{bus.driverId.phone}</Text>
              </TouchableOpacity>
            )}
          </View>
        </>
      )}
    </ScrollView>
  );

  /**
   * TAB 2: STUDENT LIST
   */
  const renderStudentsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Approved Students ({students.length})</Text>
      <FlatList
        data={students}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.studentItem}>
            <View>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentId}>ID: {item.collegeId}</Text>
            </View>
            {item.phone && (
              <TouchableOpacity style={styles.callIcon} onPress={() => Linking.openURL(`tel:${item.phone}`)}>
                <Text style={styles.callIconText}>📞</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No students registered yet.</Text>}
      />
    </View>
  );

  /**
   * TAB 3: BROADCAST FORM
   */
  const renderNoticeTab = () => (
    <ScrollView style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Broadcast Notice</Text>
        
        <Text style={styles.inputLabel}>Title</Text>
        <TextInput
          style={styles.input}
          value={noticeTitle}
          onChangeText={setNoticeTitle}
          placeholder="e.g. Bus Delay"
          placeholderTextColor={COLORS.textDim}
        />

        <Text style={styles.inputLabel}>Content</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={noticeContent}
          onChangeText={setNoticeContent}
          placeholder="Details..."
          placeholderTextColor={COLORS.textDim}
          multiline
        />

        <Text style={styles.inputLabel}>Send to:</Text>
        <View style={styles.roleContainer}>
          <TouchableOpacity 
            style={[styles.roleButton, targetRoles.includes('student') && styles.roleButtonActive]}
            onPress={() => toggleTargetRole('student')}
          >
            <Text style={[styles.roleButtonText, targetRoles.includes('student') && styles.roleButtonTextActive]}>Students</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.roleButton, targetRoles.includes('driver') && styles.roleButtonActive]}
            onPress={() => toggleTargetRole('driver')}
          >
            <Text style={[styles.roleButtonText, targetRoles.includes('driver') && styles.roleButtonTextActive]}>Drivers</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.sendButton} onPress={handleSendNotice} disabled={isLoading}>
          {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.sendButtonText}>Send Notice</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );

  /**
   * TAB 4: APPROVALS LIST
   */
  const renderApprovalsTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Pending Requests ({pendingStudents.length})</Text>
      <FlatList
        data={pendingStudents}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <View style={styles.studentItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.studentName}>{item.name}</Text>
              <Text style={styles.studentId}>ID: {item.collegeId}</Text>
            </View>
            <TouchableOpacity 
              style={styles.approveButton}
              onPress={() => handleApprove(item._id)}
              disabled={approving === item._id}
            >
              {approving === item._id ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.approveButtonText}>Approve</Text>}
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.emptyText}>No pending requests.</Text>}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerSubtitle}>Route Coordinator</Text>
          <Text style={styles.headerTitle}>{user?.name}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* TOP TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'bus' && styles.tabItemActive]}
          onPress={() => setActiveTab('bus')}
        >
          <Text style={[styles.tabText, activeTab === 'bus' && styles.tabTextActive]}>Bus Tracking</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'students' && styles.tabItemActive]}
          onPress={() => setActiveTab('students')}
        >
          <Text style={[styles.tabText, activeTab === 'students' && styles.tabTextActive]}>Students</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'notice' && styles.tabItemActive]}
          onPress={() => setActiveTab('notice')}
        >
          <Text style={[styles.tabText, activeTab === 'notice' && styles.tabTextActive]}>Broadcast</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabItem, activeTab === 'approvals' && styles.tabItemActive]}
          onPress={() => setActiveTab('approvals')}
        >
          <Text style={[styles.tabText, activeTab === 'approvals' && styles.tabTextActive]}>Approvals</Text>
          {pendingStudents.length > 0 && (
            <View style={styles.redBadge}>
              <Text style={styles.badgeTextSmall}>{pendingStudents.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'bus' && renderBusTab()}
        {activeTab === 'students' && renderStudentsTab()}
        {activeTab === 'notice' && renderNoticeTab()}
        {activeTab === 'approvals' && renderApprovalsTab()}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 24,
  },
  headerSubtitle: {
    color: COLORS.textDim,
    fontSize: 14,
  },
  headerTitle: {
    color: COLORS.text,
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    padding: 10,
  },
  logoutText: {
    color: COLORS.error,
    fontWeight: '600',
  },
  tabBar: {
    flexDirection: 'row',
    marginHorizontal: 24,
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 6,
    marginBottom: 20,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 12,
  },
  tabItemActive: {
    backgroundColor: COLORS.primary,
  },
  tabText: {
    color: COLORS.textDim,
    fontWeight: '600',
    fontSize: 11, // Smaller to fit
  },
  tabTextActive: {
    color: COLORS.white,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  tabContent: {
    flex: 1,
  },
  trackingCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
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
    fontSize: 12,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  redBadge: {
    position: 'absolute',
    top: -5,
    right: 5,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: '800',
  },
  badgeTextSmall: {
    color: COLORS.white,
    fontSize: 9,
    fontWeight: 'bold',
  },
  offlineBox: {
    marginTop: 20,
    padding: 15,
    backgroundColor: 'rgba(255,255,255,0.02)',
    borderRadius: 12,
    alignItems: 'center',
  },
  offlineText: {
    color: COLORS.textDim,
    fontStyle: 'italic',
    fontSize: 12,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
  },
  cardLabel: {
    color: COLORS.textDim,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 4,
  },
  cardValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  cardSubValue: {
    color: COLORS.primary,
    fontSize: 14,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginVertical: 16,
  },
  phoneLink: {
    color: COLORS.secondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 4,
  },
  sectionTitle: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  studentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  studentName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  studentId: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  callIcon: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  callIconText: {
    fontSize: 18,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textDim,
    marginTop: 40,
  },
  inputLabel: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 16,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    color: COLORS.text,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  roleContainer: {
    flexDirection: 'row',
    marginTop: 8,
  },
  roleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.textDim,
    marginRight: 10,
  },
  roleButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    color: COLORS.textDim,
    fontSize: 12,
    fontWeight: 'bold',
  },
  roleButtonTextActive: {
    color: COLORS.white,
  },
  sendButton: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  sendButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  approveButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  approveButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    marginTop: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  emptySubtitle: {
    color: COLORS.textDim,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default CoordinatorDashboard;

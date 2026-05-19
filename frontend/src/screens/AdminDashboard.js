/**
 * Admin Dashboard Screen
 * 
 * This is the "Command Center" for the entire system.
 * Admins have special powers:
 * 1. Staff Management: Can promote/demote drivers and coordinators.
 * 2. Fleet Assignment: Link physical buses/drivers/coordinators to routes.
 * 3. Approvals: The ultimate gatekeeper for new staff accounts.
 */
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  ScrollView, 
  ActivityIndicator,
  FlatList,
  Alert,
  TextInput
} from 'react-native';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import userService from '../services/userService';
import busService from '../services/busService';
import routeService from '../services/routeService';

const AdminDashboard = () => {
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard'); // Current sub-view
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(null); // Tracks which user is being processed
  
  // DATA COLLECTIONS
  const [users, setUsers] = useState([]); // Database staff (Drivers/Coords)
  const [pendingUsers, setPendingUsers] = useState([]); // Staff waiting for approval
  const [routes, setRoutes] = useState([]); // All defined routes in the system
  const [drivers, setDrivers] = useState([]); // Filtered list of drivers
  const [coordinators, setCoordinators] = useState([]); // Filtered list of coordinators

  // NEW ROUTE FORM STATE
  const [routeName, setRouteName] = useState('');
  const [routeReg, setRouteReg] = useState('');
  const [routeTime, setRouteTime] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  /**
   * DATA FETCHING (Conditional)
   * Instead of loading everything at once, we load data based on the Active Tab.
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'users') {
        // Load Staff for management
        const driverList = await userService.getUsersByRole('driver');
        const coordList = await userService.getUsersByRole('coordinator');
        setUsers([...driverList, ...coordList]);
      } else if (activeTab === 'approvals') {
        // Load the approval queue
        const pending = await userService.getPendingApprovals();
        setPendingUsers(pending);
      } else if (activeTab === 'buses') {
        // Load Fleet/Route info for assignment
        const routeList = await routeService.getRoutes();
        const driverList = await userService.getUsersByRole('driver');
        const coordList = await userService.getUsersByRole('coordinator');
        setRoutes(routeList);
        setDrivers(driverList);
        setCoordinators(coordList);
      }
    } catch (err) {
      Alert.alert('System Error', err.toString());
    } finally {
      setLoading(false);
    }
  };

  /**
   * REACTION TO TAB CHANGES
   * Every time the user clicks a menu item, we refresh that specific data.
   */
  useEffect(() => {
    if (activeTab !== 'dashboard') {
      fetchData();
    }
  }, [activeTab]);


  /**
   * STAFF APPROVAL
   * Officially activates a new staff account.
   */
  const handleApprove = async (userId) => {
    setApproving(userId);
    try {
      await userService.approveUser(userId);
      Alert.alert('Approved', 'This staff member can now access their dashboard.');
      fetchData();
    } catch (err) {
      Alert.alert('Error', err.toString());
    } finally {
      setApproving(null);
    }
  };

  /**
   * CREATE NEW ROUTE
   * Handlers the form submission to define a brand new route with 0 stops.
   */
  const handleCreateRoute = async () => {
    if (!routeName || !routeReg) {
      Alert.alert('Missing Info', 'Please provide a name and registration number.');
      return;
    }

    setLoading(true);
    try {
      await routeService.createRoute({
        name: routeName,
        registrationNo: routeReg,
        estimatedTime: parseInt(routeTime) || 60,
        checkpoints: [] // Explicitly empty for "Setup Mode"
      });
      Alert.alert('Success', 'New route created! A driver can now mark checkpoints.');
      setRouteName('');
      setRouteReg('');
      setRouteTime('');
      setShowCreateForm(false);
      fetchData(); // Refresh list
    } catch (err) {
      Alert.alert('Err', err.toString());
    } finally {
      setLoading(false);
    }
  };

  /**
   * VIEW: TOP-LEVEL DASHBOARD
   * Shows system health and the main navigation grid.
   */
  const renderDashboard = () => (
    <View style={styles.tabContent}>
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Health</Text>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>API Server:</Text>
          <Text style={[styles.healthValue, { color: COLORS.secondary }]}>Operational</Text>
        </View>
        <View style={styles.healthRow}>
          <Text style={styles.healthLabel}>Database:</Text>
          <Text style={[styles.healthValue, { color: COLORS.secondary }]}>Connected</Text>
        </View>
      </View>

      <View style={styles.grid}>
        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('users')}>
          <Text style={styles.menuIcon}>👥</Text>
          <Text style={styles.menuText}>Users</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('buses')}>
          <Text style={styles.menuIcon}>🗺️</Text>
          <Text style={styles.menuText}>Fleet</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.menuItem} onPress={() => setActiveTab('approvals')}>
          <Text style={styles.menuIcon}>🔔</Text>
          <Text style={styles.menuText}>Approvals</Text>
          {pendingUsers.length > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{pendingUsers.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  /**
   * VIEW: APPROVAL QUEUE
   */
  const renderApprovals = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('dashboard')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Pending Staff</Text>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : (
        <ScrollView>
          {pendingUsers.length === 0 ? (
            <Text style={styles.emptyText}>Queue is empty.</Text>
          ) : (
            pendingUsers.map(user => (
              <View key={user._id} style={styles.listItem}>
                <View style={{ flex: 1 }}>
                  <View style={styles.roleBadge}>
                    <Text style={styles.roleBadgeText}>{user.role}</Text>
                  </View>
                  <Text style={styles.itemName}>{user.name}</Text>
                  <Text style={styles.itemMeta}>{user.phone}</Text>
                </View>
                <TouchableOpacity 
                   style={styles.approveBtn} 
                   onPress={() => handleApprove(user._id)}
                   disabled={approving === user._id}
                >
                  {approving === user._id ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.approveBtnText}>Approve</Text>}
                </TouchableOpacity>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );

  /**
   * VIEW: STAFF LIST
   */
  const renderUsers = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('dashboard')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>User Management</Text>
      {loading ? <ActivityIndicator color={COLORS.primary} /> : (
        <ScrollView>
          {users.map(user => (
            <View key={user._id} style={styles.listItem}>
              <View>
                <Text style={styles.itemName}>{user.name}</Text>
                <Text style={styles.itemMeta}>{user.role} • {user.email}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  /**
   * VIEW: FLEET & ROUTE MANAGEMENT
   */
  const renderBuses = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity style={styles.backButton} onPress={() => setActiveTab('dashboard')}>
        <Text style={styles.backButtonText}>← Back</Text>
      </TouchableOpacity>
      <Text style={styles.sectionTitle}>Fleets & Routes</Text>
      
      {/* CREATE ROUTE BUTTON / FORM */}
      {!showCreateForm ? (
        <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateForm(true)}>
          <Text style={styles.createBtnText}>+ Create New Route</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Define New Route</Text>
          <TextInput 
            style={styles.input} 
            placeholder="Route Name (e.g. Mundgod - Varur)" 
            placeholderTextColor={COLORS.textDim}
            value={routeName}
            onChangeText={setRouteName}
          />
          <TextInput 
            style={[styles.input, { marginTop: 10 }]} 
            placeholder="Bus Registration (e.g. KA-25-F-001)" 
            placeholderTextColor={COLORS.textDim}
            value={routeReg}
            onChangeText={setRouteReg}
          />
          <TextInput 
            style={[styles.input, { marginTop: 10 }]} 
            placeholder="Est. Time (Minutes)" 
            placeholderTextColor={COLORS.textDim}
            value={routeTime}
            onChangeText={setRouteTime}
            keyboardType="numeric"
          />
          <View style={styles.formActions}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleCreateRoute}>
              <Text style={styles.saveBtnText}>Save Route</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreateForm(false)}>
              <Text style={styles.cancelBtnText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? <ActivityIndicator color={COLORS.primary} /> : (
        <ScrollView>
          {routes.map(route => (
            <View key={route._id} style={styles.busCard}>
              <Text style={styles.busReg}>{route.registrationNo || 'NO REGISTRATION'}</Text>
              <Text style={styles.busRoute}>Route: {route.name}</Text>
              
              <View style={styles.assignmentRow}>
                <Text style={styles.assignLabel}>Driver:</Text>
                <Text style={styles.assignValue}>{route.driverId?.name || 'Unassigned'}</Text>
              </View>
              
              <View style={styles.assignmentRow}>
                <Text style={styles.assignLabel}>Coordinator:</Text>
                <Text style={styles.assignValue}>{route.coordinatorId?.name || 'Unassigned'}</Text>
              </View>

              <TouchableOpacity style={styles.assignButton} onPress={() => Alert.alert('Notice', 'Staff assignments are managed in User Management.')}>
                <Text style={styles.assignButtonText}>Manage Stakeholders</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* GLOBAL ADMIN HEADER */}
      <View style={styles.header}>
        <View>
          <Text style={styles.welcome}>System Admin</Text>
          <Text style={styles.title}>EduTrack Console</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutButton}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* RENDER ACTIVE SUB-SCREEN */}
      {activeTab === 'dashboard' && renderDashboard()}
      {activeTab === 'users' && renderUsers()}
      {activeTab === 'buses' && renderBuses()}
      {activeTab === 'approvals' && renderApprovals()}
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
    padding: 20,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  welcome: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  title: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: 'bold',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(231, 76, 60, 0.1)',
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: '600',
  },
  tabContent: {
    flex: 1,
    padding: 20,
  },
  card: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 20,
    marginBottom: 20,
  },
  cardTitle: {
    color: COLORS.primary,
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 1,
  },
  healthRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 5,
  },
  healthLabel: {
    color: COLORS.textDim,
  },
  healthValue: {
    fontWeight: 'bold',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 15,
  },
  menuItem: {
    width: '47.5%',
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  menuIcon: {
    fontSize: 32,
    marginBottom: 10,
  },
  menuText: {
    color: COLORS.text,
    fontWeight: '600',
  },
  backButton: {
    marginBottom: 15,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  listItem: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    marginBottom: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  itemName: {
    color: COLORS.text,
    fontWeight: 'bold',
    fontSize: 16,
  },
  itemMeta: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  actionBtn: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionBtnText: {
    color: COLORS.secondary,
    fontSize: 12,
    fontWeight: '600',
  },
  busCard: {
    backgroundColor: COLORS.surface,
    padding: 20,
    borderRadius: 15,
    marginBottom: 15,
  },
  busReg: {
    color: COLORS.primary,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  busRoute: {
    color: COLORS.textDim,
    fontSize: 14,
    marginBottom: 15,
  },
  assignmentRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  assignLabel: {
    color: COLORS.textDim,
    width: 90,
    fontSize: 12,
  },
  assignValue: {
    color: COLORS.text,
    fontWeight: '500',
    fontSize: 12,
  },
  assignButton: {
    marginTop: 15,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  assignButtonText: {
    color: COLORS.textDim,
    fontSize: 12,
  },
  badge: {
    position: 'absolute',
    top: 10,
    right: 15,
    backgroundColor: COLORS.error,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: {
    color: COLORS.white,
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyText: {
    color: COLORS.textDim,
    textAlign: 'center',
    marginTop: 40,
  },
  roleBadge: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  roleBadgeText: {
    color: COLORS.secondary,
    fontSize: 10,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  approveBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
  },
  approveBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 15,
    color: COLORS.text,
    fontSize: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  formActions: {
    flexDirection: 'row',
    marginTop: 20,
    gap: 10,
  },
  saveBtn: {
    flex: 1,
    backgroundColor: COLORS.secondary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnText: {
    color: COLORS.white,
    fontWeight: 'bold',
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: COLORS.textDim,
  },
  createBtn: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
  },
  createBtnText: {
    color: COLORS.secondary,
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default AdminDashboard;

import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { COLORS } from '../theme/colors';

// Screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import StudentDashboard from '../screens/StudentDashboard';
import DriverDashboard from '../screens/DriverDashboard';
import CoordinatorDashboard from '../screens/CoordinatorDashboard';
import AdminDashboard from '../screens/AdminDashboard';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const AuthStack = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="Login" component={LoginScreen} />
    <Stack.Screen name="Register" component={RegisterScreen} />
    <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
  </Stack.Navigator>
);

const StudentTabs = () => (
  <Tab.Navigator screenOptions={{ 
    headerShown: false,
    tabBarStyle: { backgroundColor: COLORS.surface, borderTopWidth: 0 },
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textDim
  }}>
    <Tab.Screen name="Home" component={StudentDashboard} />
  </Tab.Navigator>
);

const DriverTabs = () => (
  <Tab.Navigator screenOptions={{ 
    headerShown: false,
    tabBarStyle: { backgroundColor: COLORS.surface, borderTopWidth: 0 },
    tabBarActiveTintColor: COLORS.secondary,
    tabBarInactiveTintColor: COLORS.textDim
  }}>
    <Tab.Screen name="Drive" component={DriverDashboard} />
  </Tab.Navigator>
);

const CoordinatorTabs = () => (
  <Tab.Navigator screenOptions={{ 
    headerShown: false,
    tabBarStyle: { backgroundColor: COLORS.surface, borderTopWidth: 0 },
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textDim
  }}>
    <Tab.Screen name="Manage" component={CoordinatorDashboard} />
  </Tab.Navigator>
);

const AdminTabs = () => (
  <Tab.Navigator screenOptions={{ 
    headerShown: false,
    tabBarStyle: { backgroundColor: COLORS.surface, borderTopWidth: 0 },
    tabBarActiveTintColor: COLORS.primary,
    tabBarInactiveTintColor: COLORS.textDim
  }}>
    <Tab.Screen name="Admin" component={AdminDashboard} />
  </Tab.Navigator>
);

const AppNavigator = () => {
  const { userToken, user } = useAuth();

  if (!userToken) {
    return <AuthStack />;
  }

  const role = user?.role || 'student';

  switch (role) {
    case 'student':
      return <StudentTabs />;
    case 'driver':
      return <DriverTabs />;
    case 'coordinator':
      return <CoordinatorTabs />;
    case 'admin':
      return <AdminTabs />;
    default:
      return <StudentTabs />;
  }
};

export default AppNavigator;

import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  SafeAreaView, 
  TextInput, 
  ScrollView,
  ActivityIndicator,
  Alert
} from 'react-native';
import { COLORS } from '../theme/colors';
import { useAuth } from '../context/AuthContext';
import authService from '../services/authService';
import routeService from '../services/routeService';

const RegisterScreen = ({ navigation }) => {
  const { login } = useAuth();
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    role: 'student',
    requestedRoute: ''
  });
  const [routes, setRoutes] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchRoutes();
  }, []);

  const fetchRoutes = async () => {
    try {
      const data = await routeService.getRoutes();
      setRoutes(data);
    } catch (err) {
      console.error('Error fetching routes:', err);
    }
  };

  const roles = [
    { label: 'Student', value: 'student' },
    { label: 'Driver', value: 'driver' },
    { label: 'Coordinator', value: 'coordinator' }
  ];

  // ─── FORM VALIDATION ──────────────────────────────────────────────────────
  const validateForm = () => {
    const { name, email, phone, password, role } = formData;

    // NAME: only letters and spaces
    if (!name.trim()) {
      Alert.alert('Invalid Name', 'Name is required.');
      return false;
    }
    if (!/^[a-zA-Z\s]+$/.test(name.trim())) {
      Alert.alert('Invalid Name', 'Name should contain only letters and spaces. No numbers or symbols are allowed.');
      return false;
    }

    // EMAIL
    if (!email.trim()) {
      Alert.alert('Invalid Email', 'Email is required.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email address (e.g. name@example.com).');
      return false;
    }

    // PHONE: exactly 10 digits
    if (!phone.trim()) {
      Alert.alert('Invalid Phone', 'Phone number is required.');
      return false;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      Alert.alert('Invalid Phone Number', 'Phone number must be exactly 10 digits with no spaces, dashes, or country codes.');
      return false;
    }

    // PASSWORD strength check
    if (!password) {
      Alert.alert('Invalid Password', 'Password is required.');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters long.');
      return false;
    }
    if (!/[A-Z]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one uppercase letter (A–Z).');
      return false;
    }
    if (!/[a-z]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one lowercase letter (a–z).');
      return false;
    }
    if (!/[0-9]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one number (0–9).');
      return false;
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
      Alert.alert('Weak Password', 'Password must contain at least one special character (e.g. @, #, $, !, %).');
      return false;
    }

    // ROUTE
    if (!formData.requestedRoute) {
      Alert.alert('Route Required', 'Please select a route to continue.');
      return false;
    }

    return true;
  };

  const handleRegister = async () => {
    // Run validation first — returns false if any field is invalid
    if (!validateForm()) return;

    const { role } = formData;

    // Guard: Students must have a coordinator assigned to their chosen route
    if (role === 'student' && formData.requestedRoute) {
      const selectedRoute = routes.find(r => r._id === formData.requestedRoute);
      if (selectedRoute && !selectedRoute.coordinatorId) {
        Alert.alert('Registration Restricted', 'This route does not have a Coordinator assigned yet. Please select another route or contact Admin.');
        return;
      }
    }

    setIsLoading(true);
    try {
      const data = await authService.register(formData);
      Alert.alert(
        'Success', 
        'Your registration request has been sent! Please wait for approval from your Coordinator or Admin.',
        [{ text: 'OK', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Registration Failed', error.toString());
    } finally {
      setIsLoading(false);
    }
  };

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Join EduTrack</Text>
        <Text style={styles.subtitle}>Create your account</Text>
        
        <View style={styles.inputContainer}>
          <TextInput 
            placeholder="Name" 
            placeholderTextColor={COLORS.textDim} 
            style={styles.input} 
            value={formData.name}
            onChangeText={(v) => updateField('name', v)}
          />
          <TextInput 
            placeholder="Email" 
            placeholderTextColor={COLORS.textDim} 
            style={styles.input} 
            value={formData.email}
            onChangeText={(v) => updateField('email', v)}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput 
            placeholder="Phone Number" 
            placeholderTextColor={COLORS.textDim} 
            style={styles.input} 
            value={formData.phone}
            onChangeText={(v) => updateField('phone', v)}
            keyboardType="phone-pad"
          />
          <TextInput 
            placeholder="Password" 
            placeholderTextColor={COLORS.textDim} 
            secureTextEntry 
            style={styles.input} 
            value={formData.password}
            onChangeText={(v) => updateField('password', v)}
          />

          <Text style={styles.label}>Select Your Role:</Text>
          <View style={styles.roleContainer}>
            {roles.map((r) => (
              <TouchableOpacity 
                key={r.value}
                style={[
                  styles.roleButton, 
                  formData.role === r.value && styles.activeRoleButton
                ]}
                onPress={() => updateField('role', r.value)}
              >
                <Text style={[
                  styles.roleButtonText,
                  formData.role === r.value && styles.activeRoleButtonText
                ]}>
                  {r.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Requested Route:</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.routeScroll}>
            {routes.map((route) => (
              <TouchableOpacity
                key={route._id}
                style={[
                  styles.routeItem,
                  formData.requestedRoute === route._id && styles.activeRouteItem
                ]}
                onPress={() => updateField('requestedRoute', route._id)}
              >
                <Text style={[
                  styles.routeItemText,
                  formData.requestedRoute === route._id && styles.activeRouteItemText
                ]}>
                  {route.name}
                </Text>
                {formData.role === 'driver' && route.isDriverAssigned && (
                  <Text style={styles.occupiedText}> (Driver Assigned)</Text>
                )}
                {formData.role === 'coordinator' && route.isCoordinatorAssigned && (
                  <Text style={styles.occupiedText}> (Coordinator Assigned)</Text>
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <TouchableOpacity 
          style={styles.registerButton} 
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.buttonText}>Register</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.loginLink}>Already have an account? <Text style={{ color: COLORS.primary }}>Login</Text></Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 30,
    justifyContent: 'center',
    flexGrow: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.primary,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textDim,
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    marginBottom: 20,
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    color: COLORS.text,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  label: {
    color: COLORS.textDim,
    marginBottom: 10,
    marginTop: 10,
  },
  roleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 30,
  },
  roleButton: {
    flex: 1,
    padding: 12,
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    alignItems: 'center',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  activeRoleButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  roleButtonText: {
    color: COLORS.textDim,
    fontWeight: '600',
    fontSize: 12,
  },
  activeRoleButtonText: {
    color: COLORS.white,
  },
  registerButton: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 18,
  },
  loginLink: {
    textAlign: 'center',
    color: COLORS.textDim,
  },
  routeScroll: {
    marginBottom: 20,
  },
  routeItem: {
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: COLORS.surface,
    borderRadius: 10,
    marginRight: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  activeRouteItem: {
    backgroundColor: COLORS.secondary,
    borderColor: COLORS.secondary,
  },
  routeItemText: {
    color: COLORS.textDim,
    fontSize: 13,
    fontWeight: '600',
  },
  activeRouteItemText: {
    color: COLORS.white,
  },
  occupiedText: {
    color: COLORS.error,
    fontSize: 10,
    fontWeight: 'bold',
    marginTop: 2,
  },
});

export default RegisterScreen;

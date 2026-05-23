/**
 * Forgot Password Screen
 * 
 * Provides a secure, multi-step premium flow for resetting password:
 * Step 1: User inputs registered email to receive OTP.
 * Step 2: User inputs OTP code and their new password to securely reset.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView
} from 'react-native';
import { COLORS } from '../theme/colors';
import authService from '../services/authService';

const ForgotPasswordScreen = ({ navigation }) => {
  // 1. STATE & CONTROLS
  const [step, setStep] = useState(1); // 1 = Request OTP, 2 = Verify OTP & Reset
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  /**
   * STEP 1: REQUEST OTP
   * Validates email format and sends to /api/auth/forgot-password
   */
  const handleRequestOtp = async () => {
    if (!email) {
      Alert.alert('Email Required', 'Please enter your registered email address.');
      return;
    }

    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Invalid Email', 'Please enter a valid email format.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.forgotPassword(email.trim());
      Alert.alert('Code Sent 📬', response.message || 'OTP verification code sent to your email.');
      setStep(2); // Transition to verification & reset step
    } catch (error) {
      Alert.alert('Request Failed', error.toString());
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * STEP 2: VERIFY & RESET PASSWORD
   * Submits OTP and new hashed password to /api/auth/reset-password
   */
  const handleResetPassword = async () => {
    if (!otp || !newPassword || !confirmPassword) {
      Alert.alert('Missing Fields', 'Please fill in all verification and password fields.');
      return;
    }

    if (otp.trim().length !== 6) {
      Alert.alert('Invalid OTP', 'The verification code must be exactly 6 digits.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Your password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match. Please verify.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.resetPassword(email.trim(), otp.trim(), newPassword);
      Alert.alert(
        'Success 🎉', 
        response.message || 'Your password has been reset successfully!',
        [{ text: 'Log In Now', onPress: () => navigation.navigate('Login') }]
      );
    } catch (error) {
      Alert.alert('Reset Failed', error.toString());
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            {/* Back Button */}
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
              <Text style={styles.backButtonText}>← Back to Login</Text>
            </TouchableOpacity>

            <Text style={styles.title}>Account Recovery</Text>
            <Text style={styles.subtitle}>
              {step === 1
                ? 'Enter your registered email address to receive a secure 6-digit numeric OTP code.'
                : `We sent a secure code to: ${email.toLowerCase()}. Enter it below to define your new password.`}
            </Text>

            {step === 1 ? (
              // STEP 1 UI: EMAIL FORM
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Registered Email</Text>
                  <TextInput
                    placeholder="example@college.com"
                    placeholderTextColor={COLORS.textDim}
                    style={styles.input}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleRequestOtp}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.buttonText}>Send Verification OTP</Text>
                  )}
                </TouchableOpacity>
              </View>
            ) : (
              // STEP 2 UI: OTP & NEW PASSWORD FORM
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>6-Digit Verification Code</Text>
                  <TextInput
                    placeholder="000000"
                    placeholderTextColor={COLORS.textDim}
                    style={[styles.input, styles.otpInput]}
                    value={otp}
                    onChangeText={setOtp}
                    keyboardType="number-pad"
                    maxLength={6}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>New Password</Text>
                  <TextInput
                    placeholder="At least 6 characters"
                    placeholderTextColor={COLORS.textDim}
                    secureTextEntry={true}
                    style={styles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Confirm New Password</Text>
                  <TextInput
                    placeholder="Repeat new password"
                    placeholderTextColor={COLORS.textDim}
                    secureTextEntry={true}
                    style={styles.input}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                  />
                </View>

                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleResetPassword}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => setStep(1)}
                  style={styles.resendButton}
                  disabled={isLoading}
                >
                  <Text style={styles.resendText}>Wrong email? Request code again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  content: {
    padding: 30,
  },
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 30,
    paddingVertical: 5,
  },
  backButtonText: {
    color: COLORS.primary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textDim,
    lineHeight: 22,
    marginBottom: 30,
  },
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surface,
    padding: 15,
    borderRadius: 12,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  otpInput: {
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: 8,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: COLORS.primary,
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
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
  resendButton: {
    marginTop: 20,
    alignItems: 'center',
  },
  resendText: {
    color: COLORS.secondary,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ForgotPasswordScreen;

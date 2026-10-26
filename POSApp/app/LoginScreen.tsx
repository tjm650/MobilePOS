import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api, initializeWebSocket, loginUser } from '../services/api';

const LoginScreen = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [useEmailVerification, setUseEmailVerification] = useState(true);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token && token !== 'dev_token') {
        // Verify token is still valid (skip for dev token)
        router.replace('/(tabs)');
      } else if (token === 'dev_token') {
        // Development token - go directly to dashboard
        router.replace('/(tabs)');
      }
    } catch (error) {
      console.error('Error checking existing session:', error);
    }
  };

  const handleEmailLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    setLoading(true);
    try {
      const response = await loginUser(email, password);

      if (response.access && response.user) {
        // Store tokens
        await AsyncStorage.setItem('access_token', response.access);
        await AsyncStorage.setItem('refresh_token', response.refresh);
        await AsyncStorage.setItem('user_data', JSON.stringify(response.user));

        // Initialize WebSocket connection
        await initializeWebSocket(response.user.store_id);

        router.replace('/(tabs)');
      } else {
        Alert.alert('Login Failed', 'Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Login Failed', 'Please check your credentials and try again');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailVerificationLogin = async () => {
    if (!email) {
      Alert.alert('Error', 'Please enter your email address');
      return;
    }

    setLoading(true);
    try {
      // Send verification code to email
      await api.post('/auth/send-verification/', {
        email: email,
        verification_type: 'login',
      });

      router.push({
        pathname: '/EmailVerificationScreen',
        params: { email: email, isRegistration: 'false' }
      });
    } catch (error: any) {
      console.error('Send verification error:', error);
      let errorMessage = 'Failed to send verification code. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      Alert.alert('Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleDevelopmentSkip = async () => {
    try {
      // Set development token to bypass authentication
      await AsyncStorage.setItem('access_token', 'dev_token');
      await AsyncStorage.setItem('refresh_token', 'dev_refresh_token');
      await AsyncStorage.setItem('user_data', JSON.stringify({
        id: 57,
        email: 'unity@gmail.com',
        name: 'Unity Moyo',
        store_id: "1-202ni5",
        role: 'cashier',
      }));

      // Initialize WebSocket for development
      await initializeWebSocket('1');

      router.replace('/(tabs)');
    } catch (error) {
      console.error('Development skip error:', error);
      Alert.alert('Error', 'Failed to skip authentication');
    }
  };


  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.header}>
          <Image
            source={require('../assets/images/logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Login Form */}
        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email address"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {useEmailVerification ? (
            <>
              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleEmailVerificationLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Send Verification Code</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setUseEmailVerification(false)}
              >
                <Text style={styles.toggleButtonText}>Use Password Instead</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.inputContainer}>
                <Text style={styles.label}>Password</Text>
                <TextInput
                  style={styles.input}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                  secureTextEntry
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <TouchableOpacity
                style={[styles.loginButton, loading && styles.loginButtonDisabled]}
                onPress={handleEmailLogin}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.loginButtonText}>Log In</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.toggleButton}
                onPress={() => setUseEmailVerification(true)}
              >
                <Text style={styles.toggleButtonText}>Use Email Verification Instead</Text>
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity
            style={styles.forgotPasswordButton}
            onPress={() => router.push('/ForgotPasswordScreen')}
          >
            <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <TouchableOpacity
            style={styles.registerButton}
            onPress={() => router.push('/RegistrationScreen')}
          >
            <Text style={styles.registerButtonText}>Create New Account</Text>
          </TouchableOpacity>

          {/* Development Skip Button */}
          <TouchableOpacity
            style={styles.devSkipButton}
            onPress={handleDevelopmentSkip}
          >
            <Text style={styles.devSkipButtonText}>🚧 Skip for Development</Text>
          </TouchableOpacity>

          <Text style={styles.footerText}>© 2025 Mobile POS System</Text>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    width: 150,
    height: 150,
  },
  form: {
    marginBottom: 50,
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  loginButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  loginButtonDisabled: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
  },
  registerButton: {
    backgroundColor: 'transparent',
    paddingVertical: 12,
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  registerButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  toggleButton: {
    backgroundColor: 'transparent',
    padding: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  toggleButtonText: {
    color: '#666',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  forgotPasswordButton: {
    alignItems: 'center',
    marginTop: 15,
  },
  forgotPasswordText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  footerText: {
    color: '#999',
    fontSize: 14,
    marginTop: 20,
  },
  devSkipButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ff9500',
    borderStyle: 'dashed',
  },
  devSkipButtonText: {
    color: '#ff9500',
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default LoginScreen;
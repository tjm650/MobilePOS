import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '../services/api';

const EmailVerificationScreen = () => {
  const router = useRouter();
  const { email, isRegistration } = useLocalSearchParams();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [countdown, setCountdown] = useState(0);

  const inputRefs = useRef<Array<TextInput | null>>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleCodeChange = (text: string, index: number) => {
    // Only allow numeric input
    const numericText = text.replace(/[^0-9]/g, '');

    if (numericText.length <= 1) {
      setVerificationCode(prev => {
        const newCode = prev.split('');
        newCode[index] = numericText;
        return newCode.join('');
      });

      // Auto-focus next input
      if (numericText && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerification = async () => {
    if (verificationCode.length !== 6) {
      Alert.alert('Invalid Code', 'Please enter a complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const response = await api.post('/auth/verify-email/', {
        email: email,
        verification_code: verificationCode,
      });

      if (isRegistration === 'true') {
        Alert.alert(
          'Verification Successful',
          'Your email has been verified! You can now log in to your account.',
          [
            {
              text: 'OK',
              onPress: () => router.push('/LoginScreen'),
            },
          ]
        );
      } else {
        // For login verification, this should return tokens
        const { access, refresh, user } = response.data;
        // Store tokens and navigate to main app
        Alert.alert('Login Successful', `Welcome back, ${user.username}!`);
        router.push('/(tabs)');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      let errorMessage = 'Verification failed. Please try again.';

      if (error.response?.data?.error) {
        errorMessage = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      }

      Alert.alert('Verification Failed', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (countdown > 0) return;

    setResending(true);
    try {
      await api.post('/auth/send-verification/', {
        email: email,
        verification_type: isRegistration === 'true' ? 'registration' : 'login',
      });

      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
      setCountdown(60); // 60 second cooldown
    } catch (error: any) {
      console.error('Resend error:', error);
      Alert.alert('Error', 'Failed to resend verification code. Please try again.');
    } finally {
      setResending(false);
    }
  };

  const renderCodeInputs = () => {
    return Array.from({ length: 6 }, (_, index) => (
      <TextInput
        key={index}
        ref={(ref) => { inputRefs.current[index] = ref; }}
        style={styles.codeInput}
        value={verificationCode[index] || ''}
        onChangeText={(text) => handleCodeChange(text, index)}
        onKeyPress={(e) => handleKeyPress(e, index)}
        keyboardType="numeric"
        maxLength={1}
        textAlign="center"
        textAlignVertical="center"
      />
    ));
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Email Verification</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit code to{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>
      </View>

      <View style={styles.content}>
        <Text style={styles.instruction}>
          Enter the 6-digit verification code sent to your email:
        </Text>

        <View style={styles.codeContainer}>
          {renderCodeInputs()}
        </View>

        <TouchableOpacity
          style={[styles.verifyButton, loading && styles.disabledButton]}
          onPress={handleVerification}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.verifyButtonText}>Verify Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, (resending || countdown > 0) && styles.disabledButton]}
          onPress={handleResendCode}
          disabled={resending || countdown > 0}
        >
          {resending ? (
            <ActivityIndicator color="#007bff" />
          ) : countdown > 0 ? (
            <Text style={styles.resendButtonText}>
              Resend code in {countdown}s
            </Text>
          ) : (
            <Text style={styles.resendButtonText}>Resend Code</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#007bff',
    padding: 40,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
  emailText: {
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  instruction: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
    marginBottom: 30,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 40,
  },
  codeInput: {
    width: 50,
    height: 60,
    borderWidth: 2,
    borderColor: '#007bff',
    borderRadius: 8,
    fontSize: 24,
    fontWeight: 'bold',
    backgroundColor: 'white',
  },
  verifyButton: {
    backgroundColor: '#007bff',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  disabledButton: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  resendButton: {
    padding: 16,
    alignItems: 'center',
    marginBottom: 20,
  },
  resendButtonText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '500',
  },
  backButton: {
    alignItems: 'center',
  },
  backButtonText: {
    color: '#666',
    fontSize: 16,
  },
});

export default EmailVerificationScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DrawerParamList } from '../navigation/AppNavigator';
import { STORAGE_KEYS } from '../config/constants';
import { getTaxes } from '../services/api';

type SettingsScreenNavigationProp = StackNavigationProp<DrawerParamList, 'Settings'>;

interface Props {
  navigation: SettingsScreenNavigationProp;
}

interface UserProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  store_id: string;
  role: string;
}

const SettingsScreen: React.FC<Props> = ({ navigation }) => {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [apiOverride, setApiOverride] = useState('');
  const [effectiveBaseUrl, setEffectiveBaseUrl] = useState('');
  const [testingApi, setTestingApi] = useState(false);
  const [apiStatus, setApiStatus] = useState<'unknown' | 'ok' | 'fail'>('unknown');
  const [taxes, setTaxes] = useState<any[]>([]);
  const [loadingTaxes, setLoadingTaxes] = useState(false);

  // Profile form state
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
  });

  // Feedback form state
  const [feedbackForm, setFeedbackForm] = useState({
    subject: '',
    message: '',
    rating: 5,
  });

  useEffect(() => {
    loadUserProfile();
    loadApiSettings();
    loadTaxes();
  }, []);

  const loadTaxes = async () => {
    try {
      setLoadingTaxes(true);
      const taxesData = await getTaxes();
      setTaxes(taxesData);
    } catch (error) {
      console.error('Error loading taxes:', error);
    } finally {
      setLoadingTaxes(false);
    }
  };

  const loadApiSettings = async () => {
    try {
      const [override, effective] = await Promise.all([
        AsyncStorage.getItem('api_base_url_override'),
        AsyncStorage.getItem('api_base_url_effective'),
      ]);
      setApiOverride(override || '');
      setEffectiveBaseUrl(effective || '');
      setApiStatus('unknown');
    } catch {}
  };

  const saveApiOverride = async () => {
    try {
      if (apiOverride.trim()) {
        await AsyncStorage.setItem('api_base_url_override', apiOverride.trim());
      } else {
        await AsyncStorage.removeItem('api_base_url_override');
      }
      await loadApiSettings();
      Alert.alert('Saved', 'API base URL override updated. Restart or refresh the app to re-probe.');
    } catch (e) {
      Alert.alert('Error', 'Failed to save API override');
    }
  };

  const testApiConnection = async () => {
    try {
      setTestingApi(true);
      setApiStatus('unknown');
      const base = (apiOverride && apiOverride.trim()) || effectiveBaseUrl;
      if (!base) {
        setApiStatus('fail');
        Alert.alert('API Test', 'No base URL configured. Enter an override or trigger a screen that calls the API to auto-detect.');
        return;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${base.replace(/\/$/, '')}/health`, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        setApiStatus('ok');
        Alert.alert('API Test', `Success: ${base}`);
      } else {
        setApiStatus('fail');
        Alert.alert('API Test', `Failed with HTTP ${res.status}`);
      }
    } catch (e) {
      setApiStatus('fail');
      Alert.alert('API Test', 'Connection failed');
    } finally {
      setTestingApi(false);
    }
  };

  const loadUserProfile = async () => {
    try {
      const userData = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      if (userData) {
        const user = JSON.parse(userData);
        setUserProfile(user);
        setProfileForm({
          first_name: user.first_name || '',
          last_name: user.last_name || '',
          email: user.email || '',
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                STORAGE_KEYS.ACCESS_TOKEN,
                STORAGE_KEYS.REFRESH_TOKEN,
                STORAGE_KEYS.USER_DATA,
                STORAGE_KEYS.CART_ITEMS,
              ]);

              // Navigate to login
              navigation.navigate('Login' as never);
            } catch (error) {
              console.error('Error during logout:', error);
              Alert.alert('Error', 'Failed to logout');
            }
          },
        },
      ]
    );
  };

  const handleUpdateProfile = async () => {
    if (!profileForm.first_name || !profileForm.last_name || !profileForm.email) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // In a real app, you would send this to the backend
      // For now, we'll just update local storage
      if (userProfile) {
        const updatedProfile = {
          ...userProfile,
          ...profileForm,
        };

        await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(updatedProfile));
        setUserProfile(updatedProfile);
        setShowProfileModal(false);
        Alert.alert('Success', 'Profile updated successfully');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedbackForm.subject || !feedbackForm.message) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      // In a real app, you would send this to the backend
      console.log('Feedback submitted:', feedbackForm);

      setShowFeedbackModal(false);
      setFeedbackForm({ subject: '', message: '', rating: 5 });
      Alert.alert('Thank You!', 'Your feedback has been submitted successfully');
    } catch (error) {
      console.error('Error submitting feedback:', error);
      Alert.alert('Error', 'Failed to submit feedback');
    }
  };

  const renderSettingItem = (
    icon: string,
    title: string,
    subtitle: string,
    onPress: () => void,
    showArrow: boolean = true
  ) => (
    <TouchableOpacity style={styles.settingItem} onPress={onPress}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIcon}>
          <Icon name={icon} size={24} color="#007AFF" />
        </View>
        <View style={styles.settingText}>
          <Text style={styles.settingTitle}>{title}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {showArrow && <Icon name="chevron-right" size={24} color="#ccc" />}
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Settings</Text>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>

          {renderSettingItem(
            'person',
            userProfile?.first_name && userProfile?.last_name
              ? `${userProfile.first_name} ${userProfile.last_name}`
              : userProfile?.username || 'User',
            userProfile?.role || 'Cashier',
            () => setShowProfileModal(true)
          )}

          {renderSettingItem(
            'store',
            'Store Information',
            userProfile?.store_id || 'Store ID',
            () => Alert.alert('Store Info', `Store ID: ${userProfile?.store_id}`)
          )}
        </View>

        {/* App Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Settings</Text>

          {renderSettingItem(
            'notifications',
            'Notifications',
            'Manage notification preferences',
            () => Alert.alert('Coming Soon', 'Notification settings will be available soon')
          )}

          {renderSettingItem(
            'sync',
            'Data Sync',
            'Sync settings and preferences',
            () => Alert.alert('Coming Soon', 'Sync settings will be available soon')
          )}

          {renderSettingItem(
            'backup',
            'Backup & Restore',
            'Backup your data',
            () => Alert.alert('Coming Soon', 'Backup feature will be available soon')
          )}

          {/* API Configuration */}
          <View style={styles.apiCard}>
            <Text style={styles.apiTitle}>API Connection</Text>
            <Text style={styles.apiLabel}>Effective Base URL</Text>
            <Text style={styles.apiValue}>{effectiveBaseUrl || 'Not resolved yet'}</Text>

            <Text style={[styles.apiLabel, { marginTop: 12 }]}>Override Base URL</Text>
            <TextInput
              style={styles.input}
              value={apiOverride}
              onChangeText={setApiOverride}
              placeholder="http://192.168.x.x:8000"
              autoCapitalize="none"
            />
            <View style={styles.apiButtons}>
              <TouchableOpacity style={styles.apiButton} onPress={saveApiOverride}>
                <Text style={styles.apiButtonText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.apiButton, styles.apiTestButton]} onPress={testApiConnection} disabled={testingApi}>
                <Text style={styles.apiButtonText}>{testingApi ? 'Testing...' : 'Test'}</Text>
              </TouchableOpacity>
              <View style={[styles.apiStatusDot, apiStatus === 'ok' ? styles.apiOk : apiStatus === 'fail' ? styles.apiFail : styles.apiUnknown]} />
            </View>
          </View>
        </View>

        {/* Tax Settings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Tax Configuration</Text>

          {renderSettingItem(
            'account-balance',
            'Tax Management',
            `${taxes.length} tax${taxes.length !== 1 ? 'es' : ''} configured`,
            () => navigation.navigate('Taxes' as never)
          )}

          {taxes.length > 0 && (
            <View style={styles.taxSummaryCard}>
              <Text style={styles.taxSummaryTitle}>Active Taxes</Text>
              {taxes.filter(tax => tax.isActive).map((tax, index) => (
                <View key={index} style={styles.taxItem}>
                  <Text style={styles.taxName}>{tax.name}</Text>
                  <Text style={styles.taxRate}>{tax.rate * 100}%</Text>
                </View>
              ))}
            </View>
          )}

          {loadingTaxes && (
            <View style={styles.loadingContainer}>
              <Text>Loading taxes...</Text>
            </View>
          )}
        </View>

        {/* Support */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Support</Text>

          {renderSettingItem(
            'help',
            'Help & Support',
            'Get help and support',
            () => Alert.alert('Help', 'Contact support for assistance')
          )}

          <TouchableOpacity
            style={styles.settingItem}
            onPress={() => setShowFeedbackModal(true)}
          >
            <View style={styles.settingLeft}>
              <View style={styles.settingIcon}>
                <Icon name="feedback" size={24} color="#007AFF" />
              </View>
              <View style={styles.settingText}>
                <Text style={styles.settingTitle}>Feedback</Text>
                <Text style={styles.settingSubtitle}>Help us improve the app</Text>
              </View>
            </View>
            <Icon name="chevron-right" size={24} color="#ccc" />
          </TouchableOpacity>

          {renderSettingItem(
            'info',
            'About',
            'App version and information',
            () => Alert.alert('About', 'Mobile POS v1.0.0\nBuilt with React Native')
          )}
        </View>

        {/* Logout */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Icon name="logout" size={24} color="#FF6B35" />
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Mobile POS System</Text>
          <Text style={styles.footerSubtext}>Version 1.0.0</Text>
        </View>
      </ScrollView>

      {/* Profile Edit Modal */}
      <Modal
        visible={showProfileModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowProfileModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setShowProfileModal(false)}
            >
              <Icon name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Edit Profile</Text>
            <View style={styles.modalPlaceholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={profileForm.first_name}
                  onChangeText={(text) => setProfileForm({...profileForm, first_name: text})}
                  placeholder="Enter first name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={profileForm.last_name}
                  onChangeText={(text) => setProfileForm({...profileForm, last_name: text})}
                  placeholder="Enter last name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={profileForm.email}
                  onChangeText={(text) => setProfileForm({...profileForm, email: text})}
                  placeholder="Enter email"
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleUpdateProfile}
              >
                <Text style={styles.saveButtonText}>Update Profile</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Feedback Modal */}
      <Modal
        visible={showFeedbackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFeedbackModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setShowFeedbackModal(false)}
            >
              <Icon name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Feedback</Text>
            <View style={styles.modalPlaceholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Subject</Text>
                <TextInput
                  style={styles.input}
                  value={feedbackForm.subject}
                  onChangeText={(text) => setFeedbackForm({...feedbackForm, subject: text})}
                  placeholder="What's your feedback about?"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Rating</Text>
                <View style={styles.ratingContainer}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity
                      key={star}
                      onPress={() => setFeedbackForm({...feedbackForm, rating: star})}
                    >
                      <Icon
                        name={star <= feedbackForm.rating ? 'star' : 'star-border'}
                        size={32}
                        color="#FFD700"
                      />
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Message</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={feedbackForm.message}
                  onChangeText={(text) => setFeedbackForm({...feedbackForm, message: text})}
                  placeholder="Tell us how we can improve..."
                  multiline
                  numberOfLines={4}
                />
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSubmitFeedback}
              >
                <Text style={styles.saveButtonText}>Submit Feedback</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 16,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textTransform: 'uppercase',
    marginHorizontal: 20,
    marginBottom: 12,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F0F8FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  settingText: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 2,
  },
  settingSubtitle: {
    fontSize: 14,
    color: '#666',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginHorizontal: 20,
    backgroundColor: '#FFF5F5',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B35',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  footerText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalBackButton: {
    padding: 4,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalPlaceholder: {
    width: 32,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  apiCard: {
    backgroundColor: '#fff',
    marginTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  apiTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  apiLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  apiValue: {
    fontSize: 14,
    color: '#333',
  },
  apiButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 8,
  },
  apiButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  apiTestButton: {
    backgroundColor: '#34C759',
  },
  apiButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  apiStatusDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginLeft: 8,
    backgroundColor: '#ccc',
  },
  apiOk: { backgroundColor: '#34C759' },
  apiFail: { backgroundColor: '#FF3B30' },
  apiUnknown: { backgroundColor: '#ccc' },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  taxSummaryCard: {
    backgroundColor: '#F8F9FA',
    marginHorizontal: 20,
    marginTop: 8,
    padding: 16,
    borderRadius: 8,
  },
  taxSummaryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  taxItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
  },
  taxName: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  taxRate: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '600',
  },
});

export default SettingsScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Switch,
} from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getTaxes, createTax, updateTax, deleteTax } from '../services/api';

interface Tax {
  id: number;
  name: string;
  code: string;
  rate: number;
  description: string;
  is_active: boolean;
  is_compound: boolean;
  region: string;
  created_at: string;
  updated_at: string;
}

const TaxesScreen = () => {
  const router = useRouter();
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showTaxModal, setShowTaxModal] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);
  const [formLoading, setFormLoading] = useState(false);

  const [taxForm, setTaxForm] = useState({
    name: '',
    code: '',
    rate: '',
    description: '',
    is_active: true,
    is_compound: false,
    region: '',
  });

  useEffect(() => {
    loadTaxes();
  }, []);

  const loadTaxes = async () => {
    try {
      setLoading(true);
      const taxesData = await getTaxes();
      setTaxes(taxesData);
    } catch (error) {
      console.error('Error loading taxes:', error);
      Alert.alert('Error', 'Failed to load taxes');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadTaxes();
    setRefreshing(false);
  };

  const handleAddTax = () => {
    setEditingTax(null);
    setTaxForm({
      name: '',
      code: '',
      rate: '',
      description: '',
      is_active: true,
      is_compound: false,
      region: '',
    });
    setShowTaxModal(true);
  };

  const handleEditTax = (tax: Tax) => {
    setEditingTax(tax);
    setTaxForm({
      name: tax.name,
      code: tax.code,
      rate: tax.rate.toString(),
      description: tax.description,
      is_active: tax.is_active,
      is_compound: tax.is_compound,
      region: tax.region,
    });
    setShowTaxModal(true);
  };

  const handleSaveTax = async () => {
    // Validation
    if (!taxForm.name || !taxForm.code || !taxForm.rate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    const rate = parseFloat(taxForm.rate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      Alert.alert('Error', 'Please enter a valid tax rate between 0 and 100');
      return;
    }

    setFormLoading(true);
    try {
      const taxData = {
        name: taxForm.name,
        code: taxForm.code,
        rate: rate,
        description: taxForm.description,
        is_active: taxForm.is_active,
        is_compound: taxForm.is_compound,
        region: taxForm.region,
      };

      if (editingTax) {
        await updateTax(editingTax.id, taxData);
        Alert.alert('Success', 'Tax updated successfully');
      } else {
        await createTax(taxData);
        Alert.alert('Success', 'Tax created successfully');
      }

      await loadTaxes();
      setShowTaxModal(false);
    } catch (error) {
      console.error('Error saving tax:', error);
      Alert.alert('Error', 'Failed to save tax');
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteTax = (tax: Tax) => {
    Alert.alert(
      'Delete Tax',
      `Are you sure you want to delete "${tax.name}"?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTax(tax.id);
              Alert.alert('Success', 'Tax deleted successfully');
              await loadTaxes();
            } catch (error) {
              console.error('Error deleting tax:', error);
              Alert.alert('Error', 'Failed to delete tax');
            }
          },
        },
      ]
    );
  };

  const renderTax = ({ item }: { item: Tax }) => (
    <View style={styles.taxCard}>
      <View style={styles.taxInfo}>
        <View style={styles.taxHeader}>
          <Text style={styles.taxName}>{item.name}</Text>
          <View style={styles.taxBadges}>
            {!item.is_active && (
              <View style={styles.inactiveBadge}>
                <Text style={styles.inactiveText}>Inactive</Text>
              </View>
            )}
            {item.is_compound && (
              <View style={styles.compoundBadge}>
                <Text style={styles.compoundText}>Compound</Text>
              </View>
            )}
          </View>
        </View>
        <Text style={styles.taxCode}>{item.code}</Text>
        <Text style={styles.taxRate}>{item.rate}%</Text>
        {item.description ? (
          <Text style={styles.taxDescription}>{item.description}</Text>
        ) : null}
        {item.region ? (
          <Text style={styles.taxRegion}>Region: {item.region}</Text>
        ) : null}
      </View>
      <View style={styles.taxActions}>
        <TouchableOpacity
          style={styles.editButton}
          onPress={() => handleEditTax(item)}
        >
          <MaterialIcons name="edit" size={20} color="#007AFF" />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => handleDeleteTax(item)}
        >
          <MaterialIcons name="delete" size={20} color="#FF3B30" />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Loading taxes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Tax Management</Text>
          <TouchableOpacity onPress={handleAddTax} style={styles.addButton}>
            <MaterialIcons name="add" size={24} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <FlatList
          data={taxes}
          renderItem={renderTax}
          keyExtractor={(item) => item.id.toString()}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContainer}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <MaterialIcons name="receipt" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No taxes found</Text>
              <TouchableOpacity style={styles.emptyButton} onPress={handleAddTax}>
                <Text style={styles.emptyButtonText}>Add First Tax</Text>
              </TouchableOpacity>
            </View>
          }
        />

        {/* Tax Management Modal */}
        <Modal
          visible={showTaxModal}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setShowTaxModal(false)}>
                <MaterialIcons name="close" size={24} color="#007AFF" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>
                {editingTax ? 'Edit Tax' : 'Add New Tax'}
              </Text>
              <View style={styles.placeholder} />
            </View>

            <View style={styles.modalContent}>
              <View style={styles.form}>
                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Tax Name *</Text>
                  <TextInput
                    style={styles.input}
                    value={taxForm.name}
                    onChangeText={(text) => setTaxForm(prev => ({ ...prev, name: text }))}
                    placeholder="Enter tax name (e.g., VAT, Sales Tax)"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Tax Code *</Text>
                  <TextInput
                    style={styles.input}
                    value={taxForm.code}
                    onChangeText={(text) => setTaxForm(prev => ({ ...prev, code: text }))}
                    placeholder="Enter tax code (e.g., VAT, GST)"
                    autoCapitalize="characters"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Tax Rate (%) *</Text>
                  <TextInput
                    style={styles.input}
                    value={taxForm.rate}
                    onChangeText={(text) => setTaxForm(prev => ({ ...prev, rate: text }))}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={taxForm.description}
                    onChangeText={(text) => setTaxForm(prev => ({ ...prev, description: text }))}
                    placeholder="Enter tax description (optional)"
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputContainer}>
                  <Text style={styles.label}>Region</Text>
                  <TextInput
                    style={styles.input}
                    value={taxForm.region}
                    onChangeText={(text) => setTaxForm(prev => ({ ...prev, region: text }))}
                    placeholder="Enter region (optional)"
                  />
                </View>

                <View style={styles.switchContainer}>
                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Active</Text>
                    <Switch
                      value={taxForm.is_active}
                      onValueChange={(value) => setTaxForm(prev => ({ ...prev, is_active: value }))}
                      trackColor={{ false: '#ccc', true: '#007AFF' }}
                    />
                  </View>

                  <View style={styles.switchRow}>
                    <Text style={styles.switchLabel}>Compound Tax</Text>
                    <Switch
                      value={taxForm.is_compound}
                      onValueChange={(value) => setTaxForm(prev => ({ ...prev, is_compound: value }))}
                      trackColor={{ false: '#ccc', true: '#007AFF' }}
                    />
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.saveButton, formLoading && styles.saveButtonDisabled]}
                  onPress={handleSaveTax}
                  disabled={formLoading}
                >
                  {formLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {editingTax ? 'Update Tax' : 'Add Tax'}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </SafeAreaView>
        </Modal>
      </SafeAreaView>
    </>
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  listContainer: {
    padding: 16,
  },
  taxCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  taxInfo: {
    flex: 1,
  },
  taxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  taxName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  taxBadges: {
    flexDirection: 'row',
    gap: 4,
  },
  inactiveBadge: {
    backgroundColor: '#ffebee',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  inactiveText: {
    fontSize: 10,
    color: '#c62828',
    fontWeight: '500',
  },
  compoundBadge: {
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  compoundText: {
    fontSize: 10,
    color: '#2e7d32',
    fontWeight: '500',
  },
  taxCode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  taxRate: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  taxDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  taxRegion: {
    fontSize: 12,
    color: '#888',
  },
  taxActions: {
    flexDirection: 'row',
    gap: 8,
    marginLeft: 12,
  },
  editButton: {
    padding: 8,
    backgroundColor: '#f0f8ff',
    borderRadius: 6,
  },
  deleteButton: {
    padding: 8,
    backgroundColor: '#ffebee',
    borderRadius: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 50,
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
    borderBottomColor: '#e1e1e1',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  form: {
    flex: 1,
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  switchContainer: {
    marginBottom: 20,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  switchLabel: {
    fontSize: 16,
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 20,
  },
  saveButtonDisabled: {
    backgroundColor: '#ccc',
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    padding: 8,
  },
});

export default TaxesScreen;
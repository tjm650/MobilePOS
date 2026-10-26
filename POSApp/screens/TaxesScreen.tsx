import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  Alert,
  Modal,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { DrawerParamList } from '../navigation/AppNavigator';
import { getTaxes, createTax, updateTax, deleteTax } from '../services/api';

type TaxesScreenNavigationProp = StackNavigationProp<DrawerParamList, 'Taxes'>;

interface Props {
  navigation: TaxesScreenNavigationProp;
}

interface Tax {
  id: number;
  name: string;
  code: string;
  rate: number;
  description: string;
  is_active: boolean;
  is_compound: boolean;
  region: string;
}

const TaxesScreen: React.FC<Props> = ({ navigation }) => {
  const [taxes, setTaxes] = useState<Tax[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingTax, setEditingTax] = useState<Tax | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    rate: '',
    description: '',
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

  const resetForm = () => {
    setFormData({
      name: '',
      code: '',
      rate: '',
      description: '',
      is_compound: false,
      region: '',
    });
  };

  const handleAddTax = () => {
    setEditingTax(null);
    resetForm();
    setShowAddModal(true);
  };

  const handleEditTax = (tax: Tax) => {
    setEditingTax(tax);
    setFormData({
      name: tax.name,
      code: tax.code,
      rate: tax.rate.toString(),
      description: tax.description,
      is_compound: tax.is_compound,
      region: tax.region,
    });
    setShowAddModal(true);
  };

  const handleSaveTax = async () => {
    if (!formData.name || !formData.code || !formData.rate) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const taxData = {
        name: formData.name,
        code: formData.code,
        rate: parseFloat(formData.rate),
        description: formData.description,
        is_compound: formData.is_compound,
        region: formData.region,
      };

      if (editingTax) {
        await updateTax(editingTax.id, taxData);
        Alert.alert('Success', 'Tax updated successfully');
      } else {
        await createTax(taxData);
        Alert.alert('Success', 'Tax created successfully');
      }

      setShowAddModal(false);
      resetForm();
      loadTaxes();
    } catch (error) {
      console.error('Error saving tax:', error);
      Alert.alert('Error', 'Failed to save tax');
    }
  };

  const handleDeleteTax = (tax: Tax) => {
    Alert.alert(
      'Delete Tax',
      `Are you sure you want to delete ${tax.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteTax(tax.id);
              Alert.alert('Success', 'Tax deleted successfully');
              loadTaxes();
            } catch (error) {
              console.error('Error deleting tax:', error);
              Alert.alert('Error', 'Failed to delete tax');
            }
          },
        },
      ]
    );
  };

  const renderTaxItem = ({ item }: { item: Tax }) => (
    <View style={[styles.taxCard, !item.is_active && styles.inactiveTaxCard]}>
      <View style={styles.taxHeader}>
        <View style={styles.taxInfo}>
          <Text style={styles.taxName}>{item.name}</Text>
          <Text style={styles.taxCode}>{item.code}</Text>
          <Text style={styles.taxRegion}>{item.region}</Text>
        </View>
        <View style={styles.taxActions}>
          <TouchableOpacity
            style={styles.editButton}
            onPress={() => handleEditTax(item)}
          >
            <Icon name="edit" size={20} color="#007AFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => handleDeleteTax(item)}
          >
            <Icon name="delete" size={20} color="#FF6B35" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.taxDetails}>
        <View style={styles.taxRateContainer}>
          <Text style={styles.taxRate}>{item.rate}%</Text>
          {item.is_compound && (
            <View style={styles.compoundBadge}>
              <Text style={styles.compoundText}>Compound</Text>
            </View>
          )}
        </View>
        <Text style={styles.taxDescription}>{item.description}</Text>
      </View>

      <View style={styles.taxStatus}>
        <View style={[
          styles.statusBadge,
          item.is_active ? styles.activeBadge : styles.inactiveBadge
        ]}>
          <Text style={[
            styles.statusText,
            item.is_active ? styles.activeText : styles.inactiveText
          ]}>
            {item.is_active ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Tax Management</Text>
        <TouchableOpacity style={styles.addButton} onPress={handleAddTax}>
          <Icon name="add" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      {/* Tax List */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text>Loading taxes...</Text>
        </View>
      ) : (
        <FlatList
          data={taxes}
          renderItem={renderTaxItem}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Icon name="account-balance" size={64} color="#ccc" />
              <Text style={styles.emptyText}>No taxes configured</Text>
              <Text style={styles.emptySubtext}>Add your first tax to get started</Text>
            </View>
          }
        />
      )}

      {/* Add/Edit Tax Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalBackButton}
              onPress={() => setShowAddModal(false)}
            >
              <Icon name="arrow-back" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingTax ? 'Edit Tax' : 'Add New Tax'}
            </Text>
            <View style={styles.modalPlaceholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.form}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tax Name *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={(text) => setFormData({...formData, name: text})}
                  placeholder="e.g., VAT, Sales Tax"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tax Code *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.code}
                  onChangeText={(text) => setFormData({...formData, code: text})}
                  placeholder="e.g., VAT, GST"
                  autoCapitalize="characters"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Tax Rate (%) *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.rate}
                  onChangeText={(text) => setFormData({...formData, rate: text})}
                  placeholder="e.g., 15.00"
                  keyboardType="decimal-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Region</Text>
                <TextInput
                  style={styles.input}
                  value={formData.region}
                  onChangeText={(text) => setFormData({...formData, region: text})}
                  placeholder="e.g., US, CA, NY"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  value={formData.description}
                  onChangeText={(text) => setFormData({...formData, description: text})}
                  placeholder="Tax description"
                  multiline
                  numberOfLines={3}
                />
              </View>

              <TouchableOpacity
                style={styles.compoundToggle}
                onPress={() => setFormData({...formData, is_compound: !formData.is_compound})}
              >
                <View style={[
                  styles.checkbox,
                  formData.is_compound && styles.checkboxChecked
                ]}>
                  {formData.is_compound && (
                    <Icon name="check" size={16} color="#fff" />
                  )}
                </View>
                <Text style={styles.compoundText}>Compound Tax</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={handleSaveTax}
              >
                <Text style={styles.saveButtonText}>
                  {editingTax ? 'Update Tax' : 'Create Tax'}
                </Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContainer: {
    padding: 20,
  },
  taxCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  inactiveTaxCard: {
    opacity: 0.6,
  },
  taxHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  taxInfo: {
    flex: 1,
  },
  taxName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  taxCode: {
    fontSize: 14,
    color: '#007AFF',
    marginBottom: 2,
  },
  taxRegion: {
    fontSize: 12,
    color: '#666',
  },
  taxActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButton: {
    padding: 8,
  },
  deleteButton: {
    padding: 8,
  },
  taxDetails: {
    marginBottom: 12,
  },
  taxRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  taxRate: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginRight: 12,
  },
  compoundBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  compoundText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  taxDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  taxStatus: {
    alignItems: 'flex-end',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  activeBadge: {
    backgroundColor: '#E8F5E8',
  },
  inactiveBadge: {
    backgroundColor: '#FFE8E8',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  activeText: {
    color: '#4CAF50',
  },
  inactiveText: {
    color: '#F44336',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
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
    height: 80,
    textAlignVertical: 'top',
  },
  compoundToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: '#007AFF',
  },
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
});

export default TaxesScreen;
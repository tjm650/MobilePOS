import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import { MaterialIcons } from '@expo/vector-icons';
import { RootStackParamList } from '../navigation/AppNavigator';

type ReceiptScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Receipt'>;

interface Props {
  navigation: ReceiptScreenNavigationProp;
  route: {
    params: {
      saleData: any;
    };
  };
}

const ReceiptScreen: React.FC<Props> = ({ navigation, route }) => {
  const { saleData } = route.params;

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString(),
    };
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const handleNewSale = () => {
    navigation.popToTop();
    navigation.navigate('Main');
  };

  const handleBackToDashboard = () => {
    navigation.popToTop();
  };

  const receiptDateTime = formatDateTime(saleData.created_at);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.successIcon}>
            <MaterialIcons name="check-circle" size={48} color="#4CAF50" />
          </View>
          <Text style={styles.title}>Payment Successful!</Text>
          <Text style={styles.subtitle}>Thank you for your purchase</Text>
        </View>

        {/* Receipt */}
        <View style={styles.receipt}>
          {/* Receipt Header */}
          <View style={styles.receiptHeader}>
            <Text style={styles.storeName}>POS Store</Text>
            <Text style={styles.receiptTitle}>Sales Receipt</Text>
            <View style={styles.receiptDetails}>
              <Text style={styles.receiptInfo}>Receipt #: {saleData.id}</Text>
              <Text style={styles.receiptInfo}>Date: {receiptDateTime.date}</Text>
              <Text style={styles.receiptInfo}>Time: {receiptDateTime.time}</Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items Purchased</Text>
            {saleData.items.map((item: any, index: number) => (
              <View key={index} style={styles.item}>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName}>{item.product_name}</Text>
                  <Text style={styles.itemBarcode}>{item.product_barcode}</Text>
                </View>
                <View style={styles.itemDetails}>
                  <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
                  <Text style={styles.itemPrice}>
                    {formatCurrency(item.unit_price)}
                  </Text>
                  <Text style={styles.itemTotal}>
                    {formatCurrency(item.total_price)}
                  </Text>
                </View>
              </View>
            ))}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(saleData.total_amount)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax (8%):</Text>
              <Text style={styles.totalAmount}>
                {formatCurrency(saleData.total_amount * 0.08)}
              </Text>
            </View>
            <View style={[styles.totalRow, styles.finalTotal]}>
              <Text style={styles.finalTotalLabel}>Total:</Text>
              <Text style={styles.finalTotalAmount}>
                {formatCurrency(saleData.total_amount * 1.08)}
              </Text>
            </View>
          </View>

          {/* Payment Info */}
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment Information</Text>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentLabel}>Payment Method:</Text>
              <Text style={styles.paymentValue}>{saleData.payment_method}</Text>
            </View>
            <View style={styles.paymentInfo}>
              <Text style={styles.paymentLabel}>Status:</Text>
              <Text style={[styles.paymentValue, styles.successStatus]}>
                {saleData.status}
              </Text>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.receiptFooter}>
            <Text style={styles.footerText}>Thank you for shopping with us!</Text>
            <Text style={styles.footerSubtext}>
              Please keep this receipt for your records
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryAction} onPress={handleNewSale}>
            <Icon name="add" size={20} color="#fff" />
            <Text style={styles.primaryActionText}>New Sale</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryAction}
            onPress={handleBackToDashboard}
          >
            <Text style={styles.secondaryActionText}>Back to Dashboard</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 32,
    backgroundColor: '#fff',
  },
  successIcon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#4CAF50',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
  receipt: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    borderRadius: 12,
    marginBottom: 20,
    padding: 20,
  },
  receiptHeader: {
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    paddingBottom: 16,
    marginBottom: 16,
  },
  storeName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  receiptTitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 12,
  },
  receiptDetails: {
    alignItems: 'center',
  },
  receiptInfo: {
    fontSize: 12,
    color: '#999',
    marginBottom: 2,
  },
  itemsSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
  },
  itemBarcode: {
    fontSize: 12,
    color: '#666',
  },
  itemDetails: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 12,
    color: '#666',
  },
  itemPrice: {
    fontSize: 12,
    color: '#666',
  },
  itemTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  totalsSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 16,
    marginBottom: 20,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingTop: 8,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 14,
    color: '#666',
  },
  totalAmount: {
    fontSize: 14,
    color: '#333',
  },
  finalTotalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  finalTotalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  paymentSection: {
    marginBottom: 20,
  },
  paymentInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  paymentLabel: {
    fontSize: 14,
    color: '#666',
  },
  paymentValue: {
    fontSize: 14,
    color: '#333',
  },
  successStatus: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  receiptFooter: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  footerSubtext: {
    fontSize: 12,
    color: '#666',
  },
  actions: {
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  primaryAction: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 12,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryAction: {
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#007AFF',
    alignItems: 'center',
    paddingVertical: 12,
  },
  secondaryActionText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
});

export default ReceiptScreen;
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Alert,
} from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { RootStackParamList } from '../navigation/AppNavigator';
import { processPayment } from '../services/api';
import { taxService } from '../services/taxService';

type CheckoutScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Checkout'>;

interface Props {
  navigation: CheckoutScreenNavigationProp;
  route: {
    params: {
      cartItems: any[];
      total: number;
    };
  };
}

const CheckoutScreen: React.FC<Props> = ({ navigation, route }) => {
  const { cartItems, total } = route.params;
  const [paymentMethod, setPaymentMethod] = useState('');
  const [processing, setProcessing] = useState(false);
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxBreakdown, setTaxBreakdown] = useState<any[]>([]);

  useEffect(() => {
    calculateTaxes();
  }, []);

  const calculateTaxes = async () => {
    try {
      const taxSummary = taxService.calculateCartTaxes(total);
      setTaxAmount(taxSummary.totalTax);
      setTaxBreakdown(taxSummary.taxBreakdown);
    } catch (error) {
      console.error('Error calculating taxes:', error);
      // Fallback to 8% if tax service fails
      setTaxAmount(total * 0.08);
    }
  };

  const paymentMethods = [
    { id: 'cash', name: 'Cash', icon: 'money' },
    { id: 'card', name: 'Card', icon: 'credit-card' },
    { id: 'mobile', name: 'Mobile Payment', icon: 'smartphone' },
  ];

  const handlePayment = async () => {
    if (!paymentMethod) {
      Alert.alert('Error', 'Please select a payment method');
      return;
    }

    setProcessing(true);
    try {
      const saleData = await processPayment(cartItems, total, paymentMethod);

      // Navigate to receipt with proper parameters
      navigation.replace('Receipt', {
        isOnline: 'true',
        saleId: saleData.sale_id || `sale_${Date.now()}`,
        paymentMethod: paymentMethod,
        total: (total + taxAmount).toString(),
        taxAmount: taxAmount.toString(),
        taxBreakdown: JSON.stringify(taxBreakdown),
        receiptData: JSON.stringify({
          items: cartItems,
          subtotal: total,
          tax: taxAmount,
          total: total + taxAmount,
          paymentMethod: paymentMethod,
          taxBreakdown: taxBreakdown,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      console.error('Payment error:', error);
      Alert.alert('Payment Failed', 'Please try again');
    } finally {
      setProcessing(false);
    }
  };

  const renderCartItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.product.name}</Text>
        <Text style={styles.itemBarcode}>{item.product.barcode}</Text>
      </View>
      <View style={styles.itemDetails}>
        <Text style={styles.itemQuantity}>Qty: {item.quantity}</Text>
        <Text style={styles.itemPrice}>${item.totalPrice.toFixed(2)}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Icon name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.contentContainer}>
        {/* Cart Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            style={styles.cartList}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>
          {paymentMethods.map((method) => (
            <TouchableOpacity
              key={method.id}
              style={[
                styles.paymentMethod,
                paymentMethod === method.id && styles.selectedPaymentMethod,
              ]}
              onPress={() => setPaymentMethod(method.id)}
            >
              <Icon
                name={method.icon}
                size={24}
                color={paymentMethod === method.id ? '#007AFF' : '#666'}
              />
              <Text
                style={[
                  styles.paymentMethodText,
                  paymentMethod === method.id && styles.selectedPaymentMethodText,
                ]}
              >
                {method.name}
              </Text>
              {paymentMethod === method.id && (
                <Icon name="check-circle" size={20} color="#007AFF" />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Total */}
        <View style={styles.totalSection}>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal:</Text>
            <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
          </View>

          {taxBreakdown.length > 0 ? (
            taxBreakdown.map((taxItem, index) => (
              <View key={index} style={styles.totalRow}>
                <Text style={styles.totalLabel}>
                  {taxItem.tax.name} ({(taxItem.tax.rate * 100).toFixed(1)}%):
                </Text>
                <Text style={styles.totalAmount}>
                  ${taxItem.amount.toFixed(2)}
                </Text>
              </View>
            ))
          ) : (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Tax:</Text>
              <Text style={styles.totalAmount}>${taxAmount.toFixed(2)}</Text>
            </View>
          )}

          <View style={[styles.totalRow, styles.finalTotal]}>
            <Text style={styles.finalTotalLabel}>Total:</Text>
            <Text style={styles.finalTotalAmount}>
              ${(total + taxAmount).toFixed(2)}
            </Text>
          </View>
        </View>

        {/* Checkout Button */}
        <View style={styles.checkoutButtonContainer}>
          <TouchableOpacity
            style={[styles.checkoutButton, processing && styles.checkoutButtonDisabled]}
            onPress={handlePayment}
            disabled={processing}
          >
            <Text style={styles.checkoutButtonText}>
              {processing ? 'Processing...' : 'Complete Payment'}
            </Text>
          </TouchableOpacity>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  backButton: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  placeholder: {
    width: 32,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
    paddingBottom: 100, // Extra padding to avoid bottom navigation overlap
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  cartList: {
    maxHeight: 150,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
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
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  paymentMethod: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    marginBottom: 8,
  },
  selectedPaymentMethod: {
    borderColor: '#007AFF',
    backgroundColor: '#F0F8FF',
  },
  paymentMethodText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  selectedPaymentMethodText: {
    color: '#007AFF',
    fontWeight: '600',
  },
  totalSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 12,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalAmount: {
    fontSize: 16,
    color: '#333',
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  finalTotalAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  checkoutButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40, // Extra bottom padding to avoid navigation overlap
    backgroundColor: '#f5f5f5',
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  checkoutButtonDisabled: {
    backgroundColor: '#ccc',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default CheckoutScreen;
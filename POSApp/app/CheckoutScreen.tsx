import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { cartService, CartItem } from '../services/cartService';
import { databaseService } from '../services/database';
import { taxService, CartTaxSummary } from '../services/taxService';
import { syncService } from '../services/syncService';

const CheckoutScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'card' | 'mobile'>('cash');
  const [taxSummary, setTaxSummary] = useState<CartTaxSummary | null>(null);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    loadCart();

    // Monitor network status
    const unsubscribe = syncService.addSyncListener((status) => {
      setIsOnline(status.isOnline);
    });

    return unsubscribe;
  }, []);

  const loadCart = async () => {
    try {
      const items = await cartService.getCartItems();
      console.log('Checkout cart items:', items.map(item => ({
        name: item.product.product_name,
        price: item.product.selling_price,
        quantity: item.quantity
      })));
      setCart(items);

      // Calculate tax using taxService instead of non-existent cartService method
      if (items.length > 0) {
        const subtotal = items.reduce((total, item) => total + ((item.product.selling_price || 0) * item.quantity), 0);
        const taxSummary = taxService.calculateCartTaxes(subtotal);
        setTaxSummary(taxSummary);
      }
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const getCartTotal = () => {
    if (taxSummary) {
      return taxSummary.totalAmount;
    }
    return cart.reduce((total, item) => total + (item.product.selling_price * item.quantity), 0);
  };

  const getSubtotal = () => {
    return cart.reduce((total, item) => total + ((item.product.selling_price || 0) * item.quantity), 0);
  };

  const getTotalTax = () => {
    if (taxSummary) {
      return taxSummary.totalTax;
    }
    return 0;
  };

  const getTotalItems = () => {
    return cart.reduce((total, item) => total + item.quantity, 0);
  };

  const handlePayment = async () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before checkout.');
      return;
    }

    setIsProcessing(true);

    try {
      // Get tax-inclusive total and tax breakdown
      const totalAmount = taxSummary?.totalAmount || getCartTotal();
      const subtotal = taxSummary?.subtotal || getCartTotal();
      const taxAmount = totalAmount - subtotal;
      const taxBreakdown = taxSummary?.taxBreakdown || [];

      // Create sale record in database
      const saleData = {
        items: JSON.stringify(cart.map(item => ({
          id: item.product.id,
          name: item.product.product_name,
          price: item.product.selling_price,
          quantity: item.quantity,
          barcode: item.product.barcode,
        }))),
        total_amount: totalAmount,
        payment_method: paymentMethod,
        tax_amount: taxAmount,
        tax_breakdown: JSON.stringify(taxBreakdown.map(taxItem => ({
          tax_id: taxItem.tax.id,
          tax_name: taxItem.tax.name,
          tax_rate: taxItem.tax.rate,
          tax_amount: taxItem.amount,
        }))),
      };

      // Generate receipt data for offline storage
      const saleId = Date.now().toString();
      const receiptData = {
        saleId: saleId,
        date: new Date().toLocaleString(),
        storeName: 'POS Store',
        storeAddress: 'Bulawayo Zimbabwe',
        items: cart.map(item => ({
          name: item.product.product_name,
          barcode: item.product.barcode,
          quantity: item.quantity,
          price: item.product.selling_price,
          total: item.product.selling_price * item.quantity,
        })),
        subtotal: subtotal,
        taxBreakdown: taxBreakdown,
        total: totalAmount,
        paymentMethod: paymentMethod,
        status: isOnline ? 'Online Sale' : 'Offline Sale - Pending Sync',
      };

      if (isOnline) {
        // Online: Try to sync immediately
        try {
          // Queue sale for sync (when backend is available)
          await databaseService.queueSale(saleData);

          // Clear cart
          await cartService.clearCart();

          // Navigate to receipt screen with online data
          router.push({
            pathname: '/ReceiptScreen',
            params: {
              saleId: saleId,
              total: totalAmount.toString(),
              subtotal: subtotal.toString(),
              taxAmount: taxAmount.toString(),
              items: getTotalItems().toString(),
              paymentMethod: paymentMethod,
              taxBreakdown: JSON.stringify(taxBreakdown),
              isOnline: 'true',
            }
          });
        } catch (apiError) {
          // If API fails, save offline
          await saveOfflineReceipt(saleId, receiptData, saleData);
        }
      } else {
        // Offline: Save receipt locally
        await saveOfflineReceipt(saleId, receiptData, saleData);
      }

    } catch (error) {
      console.error('Payment processing error:', error);
      Alert.alert(
        'Payment Error',
        'Failed to process payment. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const saveOfflineReceipt = async (saleId: string, receiptData: any, saleData: any) => {
    try {
      // Save receipt for offline printing
      await databaseService.saveOfflineReceipt({
        sale_id: saleId,
        receipt_data: JSON.stringify(receiptData),
        items: saleData.items,
        total_amount: saleData.total_amount,
        subtotal_amount: receiptData.subtotal,
        tax_amount: saleData.tax_amount,
        tax_breakdown: saleData.tax_breakdown,
        payment_method: saleData.payment_method,
      });

      // Queue sale for sync when online
      await databaseService.queueSale(saleData);

      // Clear cart
      await cartService.clearCart();

      // Navigate to receipt screen with offline data
      router.push({
        pathname: '/ReceiptScreen',
        params: {
          saleId: saleId,
          total: receiptData.total.toString(),
          subtotal: receiptData.subtotal.toString(),
          taxAmount: saleData.tax_amount.toString(),
          items: getTotalItems().toString(),
          paymentMethod: paymentMethod,
          taxBreakdown: JSON.stringify(receiptData.taxBreakdown),
          isOnline: 'false',
          receiptData: JSON.stringify(receiptData),
        }
      });
    } catch (error) {
      console.error('Error saving offline receipt:', error);
      Alert.alert('Error', 'Failed to save receipt for offline printing.');
    }
  };

  const updateQuantity = async (productId: number, newQuantity: number) => {
    try {
      if (newQuantity <= 0) {
        await cartService.removeFromCart(productId);
      } else {
        await cartService.updateQuantity(productId, newQuantity);
      }
      await loadCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
    }
  };

  const removeFromCart = async (productId: number) => {
    try {
      await cartService.removeFromCart(productId);
      await loadCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
    }
  };

  if (cart.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <MaterialIcons name="shopping-cart" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <TouchableOpacity
            style={styles.backToScanButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backToScanButtonText}>Back to Scanner</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Offline Mode Banner */}
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <MaterialIcons name="wifi-off" size={20} color="#fff" />
          <Text style={styles.offlineBannerText}>
            Offline Mode - Sale will be synced when online
          </Text>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Order Summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Order Summary</Text>

          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <Text style={styles.cartItemName} numberOfLines={2}>
                    {item.product.product_name}
                  </Text>
                  <Text style={styles.cartItemPrice}>
                    ${item.product.selling_price?.toFixed(2) || '0.00'} × {item.quantity}
                  </Text>
                </View>
                <View style={styles.cartItemActions}>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product.id, item.quantity - 1)}
                  >
                    <MaterialIcons name="remove" size={16} color="#007AFF" />
                  </TouchableOpacity>
                  <Text style={styles.cartItemQuantity}>{item.quantity}</Text>
                  <TouchableOpacity
                    style={styles.quantityButton}
                    onPress={() => updateQuantity(item.product.id, item.quantity + 1)}
                  >
                    <MaterialIcons name="add" size={16} color="#007AFF" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => removeFromCart(item.product.id)}
                  >
                    <MaterialIcons name="delete" size={16} color="#ff3b30" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />
        </View>

        {/* Payment Method */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Method</Text>

          <View style={styles.paymentMethods}>
            <TouchableOpacity
              style={[
                styles.paymentMethod,
                paymentMethod === 'cash' && styles.paymentMethodSelected,
              ]}
              onPress={() => setPaymentMethod('cash')}
            >
              <MaterialIcons
                name="money"
                size={24}
                color={paymentMethod === 'cash' ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'cash' && styles.paymentMethodTextSelected,
              ]}>
                Cash
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethod,
                paymentMethod === 'card' && styles.paymentMethodSelected,
              ]}
              onPress={() => setPaymentMethod('card')}
            >
              <MaterialIcons
                name="credit-card"
                size={24}
                color={paymentMethod === 'card' ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'card' && styles.paymentMethodTextSelected,
              ]}>
                Card
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.paymentMethod,
                paymentMethod === 'mobile' && styles.paymentMethodSelected,
              ]}
              onPress={() => setPaymentMethod('mobile')}
            >
              <MaterialIcons
                name="smartphone"
                size={24}
                color={paymentMethod === 'mobile' ? '#007AFF' : '#666'}
              />
              <Text style={[
                styles.paymentMethodText,
                paymentMethod === 'mobile' && styles.paymentMethodTextSelected,
              ]}>
                Mobile
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Order Total */}
        <View style={styles.section}>
          <View style={styles.totalContainer}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal ({getTotalItems()} items)</Text>
              <Text style={styles.totalValue}>${getSubtotal().toFixed(2)}</Text>
            </View>

            {taxSummary && taxSummary.taxBreakdown.length > 0 ? (
              <>
                {taxSummary.taxBreakdown.map((taxItem, index) => (
                  <View key={index} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      {taxItem.tax.name} ({(taxItem.tax.rate * 100).toFixed(1)}%)
                    </Text>
                    <Text style={styles.totalValue}>
                      ${taxItem.amount.toFixed(2)}
                    </Text>
                  </View>
                ))}
                <View style={[styles.totalRow, styles.finalTotal]}>
                  <Text style={styles.finalTotalLabel}>Total (incl. tax)</Text>
                  <Text style={styles.finalTotalValue}>
                    ${taxSummary.totalAmount.toFixed(2)}
                  </Text>
                </View>
              </>
            ) : (
              <View style={[styles.totalRow, styles.finalTotal]}>
                <Text style={styles.finalTotalLabel}>Total</Text>
                <Text style={styles.finalTotalValue}>
                  ${getCartTotal().toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Process Payment Button */}
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.processButton, isProcessing && styles.processButtonDisabled]}
          onPress={handlePayment}
          disabled={isProcessing}
        >
          {isProcessing ? (
            <View style={styles.processingContainer}>
              <ActivityIndicator color="#fff" size="small" />
              <Text style={styles.processButtonText}>
                {isOnline ? 'Processing...' : 'Saving Offline...'}
              </Text>
            </View>
          ) : (
            <Text style={styles.processButtonText}>
              {isOnline ? 'Process Payment' : 'Save Offline Sale'} (${getCartTotal().toFixed(2)})
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 16,
    marginBottom: 24,
  },
  backToScanButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backToScanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  placeholder: {
    width: 40,
  },
  offlineBanner: {
    backgroundColor: '#ff3b30',
    paddingHorizontal: 20,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  cartItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  quantityButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cartItemQuantity: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 24,
    textAlign: 'center',
  },
  removeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentMethods: {
    flexDirection: 'row',
    gap: 12,
  },
  paymentMethod: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#e1e1e1',
    gap: 8,
  },
  paymentMethodSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#f0f8ff',
  },
  paymentMethodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  paymentMethodTextSelected: {
    color: '#007AFF',
  },
  totalContainer: {
    gap: 8,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  finalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    paddingTop: 8,
    marginTop: 8,
  },
  finalTotalLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  finalTotalValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  footer: {
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    padding: 20,
  },
  processButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  processButtonDisabled: {
    backgroundColor: '#ccc',
  },
  processingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  processButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default CheckoutScreen;
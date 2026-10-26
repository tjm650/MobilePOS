import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Share,
  ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { cartService } from '../services/cartService';
import { databaseService } from '../services/database';
import { taxService, TaxCalculation } from '../services/taxService';

interface ReceiptItem {
  id: number;
  name: string;
  price: number;
  quantity: number;
  barcode: string;
}

interface TaxBreakdownItem {
  tax_id: number;
  tax_name: string;
  tax_rate: number;
  tax_amount: number;
}

interface TaxCalculationWithDetails extends TaxCalculation {
  tax_name: string;
  tax_rate: number;
}

const ReceiptScreen = () => {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const [cartItems, setCartItems] = useState<ReceiptItem[]>([]);
  const [isOfflineReceipt, setIsOfflineReceipt] = useState(false);
  const [receiptData, setReceiptData] = useState<any>(null);
  const [taxBreakdown, setTaxBreakdown] = useState<TaxBreakdownItem[]>([]);
  const [calculatedTaxes, setCalculatedTaxes] = useState<TaxCalculationWithDetails[]>([]);

  useEffect(() => {
    // In a real app, you would fetch the actual receipt data using the saleId
    // For now, we'll show a sample receipt
    loadReceiptData();
  }, []);

  const loadReceiptData = async () => {
    try {
      // Check if this is an offline receipt
      const isOffline = params.isOnline === 'false';
      setIsOfflineReceipt(isOffline);

      let receiptItems: ReceiptItem[] = [];

      // If offline receipt, parse receipt data from params
      if (isOffline && params.receiptData) {
        try {
          const parsedReceiptData = JSON.parse(params.receiptData as string);
          setReceiptData(parsedReceiptData);

          // Convert receipt items to ReceiptItem format
          receiptItems = parsedReceiptData.items.map((item: any) => ({
            id: Math.random(), // Generate temporary ID
            name: item.product?.name || item.name,
            price: item.product?.price || item.price,
            quantity: item.quantity,
            barcode: item.product?.barcode || item.barcode,
          }));

          // Parse tax breakdown if available
          if (parsedReceiptData.taxBreakdown) {
            setTaxBreakdown(parsedReceiptData.taxBreakdown);
          }
        } catch (error) {
          console.error('Error parsing offline receipt data:', error);
        }
      } else {
        // Online receipt - use data passed from CheckoutScreen instead of cleared cart
        if (params.items && params.subtotal && params.total && params.saleId) {
          const itemsCount = parseInt(params.items as string);
          const subtotal = parseFloat(params.subtotal as string);
          const total = parseFloat(params.total as string);

          // For online receipts, try to get the sale data from offline_sales table
          try {
            // Get pending sales and find the one with matching saleId (which is timestamp-based)
            const pendingSales = await databaseService.getPendingSales();
            const matchingSale = pendingSales.find(sale => {
              // Since saleId is timestamp-based, we can match by approximate time
              const saleTimestamp = parseInt(params.saleId as string);
              const saleDate = new Date(parseInt(sale.created_at));
              const paramDate = new Date(saleTimestamp);
              // Match sales within 1 minute
              return Math.abs(saleDate.getTime() - paramDate.getTime()) < 60000;
            });

            if (matchingSale && matchingSale.items) {
              const parsedItems = JSON.parse(matchingSale.items);
              receiptItems = parsedItems.map((item: any, index: number) => ({
                id: index,
                name: item.name,
                price: item.price,
                quantity: item.quantity,
                barcode: item.barcode,
              }));
            } else {
              // Fallback: create a summary entry if we can't find the exact sale
              receiptItems = [{
                id: 1,
                name: `${itemsCount} item${itemsCount > 1 ? 's' : ''}`,
                price: subtotal / itemsCount,
                quantity: itemsCount,
                barcode: 'N/A',
              }];
            }
          } catch (error) {
            console.error('Error getting sale data from database:', error);
            // Fallback: create a summary entry
            receiptItems = [{
              id: 1,
              name: `${itemsCount} item${itemsCount > 1 ? 's' : ''}`,
              price: subtotal / itemsCount,
              quantity: itemsCount,
              barcode: 'N/A',
            }];
          }

          // Parse tax breakdown from params if available
          if (params.taxBreakdown) {
            try {
              const parsedTaxBreakdown = JSON.parse(params.taxBreakdown as string);
              setTaxBreakdown(parsedTaxBreakdown);
            } catch (error) {
              console.error('Error parsing tax breakdown:', error);
            }
          }
        }
      }

      setCartItems(receiptItems);

      // Calculate taxes using the tax service
      await calculateTaxes(receiptItems);
    } catch (error) {
      console.error('Error loading receipt data:', error);
    }
  };

  const calculateTaxes = async (items: ReceiptItem[]) => {
    try {
      // Calculate subtotal
      const subtotal = items.reduce((total, item) => total + (item.price * item.quantity), 0);

      // Get active taxes from the tax service
      const activeTaxes = await taxService.getActiveTaxes();

      if (activeTaxes.length === 0) {
        // No taxes configured, use existing tax breakdown or set empty
        setCalculatedTaxes([]);
        return;
      }

      // Calculate taxes using the tax service
      const taxSummary = taxService.calculateCartTaxes(subtotal);

      // Convert tax calculations to our format with tax details
      const calculatedTaxBreakdown: TaxCalculationWithDetails[] = taxSummary.taxBreakdown.map(taxCalc => ({
        ...taxCalc,
        tax_name: taxCalc.tax.name,
        tax_rate: taxCalc.tax.rate,
      }));

      setCalculatedTaxes(calculatedTaxBreakdown);
    } catch (error) {
      console.error('Error calculating taxes:', error);
    }
  };

  const getSubtotal = () => {
    return cartItems.reduce((total, item) => total + ((item.price || 0) * item.quantity), 0);
  };

  const getTax = () => {
    // Use calculated taxes if available, otherwise fall back to tax breakdown or params
    if (calculatedTaxes.length > 0) {
      return calculatedTaxes.reduce((total, taxItem) => total + taxItem.amount, 0);
    }

    if (taxBreakdown.length > 0) {
      return taxBreakdown.reduce((total, taxItem) => total + taxItem.tax_amount, 0);
    }

    return parseFloat(params.taxAmount as string) || 0;
  };

  const getTotal = () => {
    // Use params total if available (for completed sales), otherwise calculate
    const paramsTotal = parseFloat(params.total as string);
    if (paramsTotal && paramsTotal > 0) {
      return paramsTotal;
    }

    return getSubtotal() + getTax();
  };

  const handleNewSale = () => {
    router.push('/ScannerScreen');
  };

  const handleShareReceipt = async () => {
    try {
      const receiptText = generateReceiptText();
      await Share.share({
        message: receiptText,
        title: 'Receipt',
      });
    } catch (error) {
      console.error('Error sharing receipt:', error);
    }
  };

  const generateReceiptText = () => {
    const date = new Date().toLocaleString();
    let receipt = `🧾 RECEIPT\n\n`;
    receipt += `Date: ${date}\n`;
    receipt += `Sale ID: ${params.saleId || 'N/A'}\n`;
    receipt += `Payment: ${params.paymentMethod || 'Cash'}\n\n`;
    receipt += `Items:\n`;

    cartItems.forEach(item => {
      receipt += `${item.name}\n`;
      receipt += `  ${item.quantity}x $${item.price.toFixed(2)} = $${(item.quantity * item.price).toFixed(2)}\n`;
    });

    receipt += `\nSubtotal: $${getSubtotal().toFixed(2)}\n`;

    // Use calculated taxes if available, otherwise use tax breakdown
    if (calculatedTaxes.length > 0) {
      calculatedTaxes.forEach(taxItem => {
        receipt += `${taxItem.tax_name} (${(taxItem.tax_rate).toFixed(1)}%): $${taxItem.amount.toFixed(2)}\n`;
      });
    } else if (taxBreakdown.length > 0) {
      taxBreakdown.forEach(taxItem => {
        receipt += `${taxItem.tax_name} (${(taxItem.tax_rate * 100).toFixed(1)}%): $${taxItem.tax_amount.toFixed(2)}\n`;
      });
    } else {
      receipt += `Tax: $${getTax().toFixed(2)}\n`;
    }

    receipt += `Total: $${getTotal().toFixed(2)}\n\n`;
    receipt += `Thank you for your purchase!`;

    return receipt;
  };

  const handlePrintReceipt = async () => {
    try {
      // Mark receipt as printed if it's an offline receipt
      if (isOfflineReceipt && params.saleId) {
        // Find the receipt in the database and mark it as printed
        const receipt = await databaseService.getReceiptBySaleId(params.saleId as string);
        if (receipt) {
          await databaseService.markReceiptAsPrinted(receipt.id!);
        }
      }

      // In a real app, this would connect to a printer
      Alert.alert(
        'Print Receipt',
        isOfflineReceipt
          ? 'Receipt printed successfully! Will be synced when connection is restored.'
          : 'Receipt printing feature would be implemented here with a printer service.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error printing receipt:', error);
      Alert.alert('Error', 'Failed to print receipt.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Receipt</Text>
          {isOfflineReceipt && (
            <View style={styles.offlineIndicator}>
              <MaterialIcons name="wifi-off" size={14} color="#ff3b30" />
              <Text style={styles.offlineText}>Offline Receipt</Text>
            </View>
          )}
        </View>
        <TouchableOpacity onPress={handleShareReceipt} style={styles.shareButton}>
          <MaterialIcons name="share" size={24} color="#007AFF" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Receipt Container */}
        <View style={styles.receiptContainer}>
          {/* Receipt Header */}
          <View style={styles.receiptHeader}>
            <MaterialIcons name="receipt" size={48} color="#007AFF" />
            <Text style={styles.storeName}>POS Store</Text>
            <Text style={styles.storeAddress}>Bulawayo, Zimbabwe</Text>
            <Text style={styles.receiptDate}>
              {new Date().toLocaleString()}
            </Text>
          </View>

          {/* Sale Info */}
          <View style={styles.saleInfo}>
            <View style={styles.saleInfoRow}>
              <Text style={styles.saleInfoLabel}>Sale ID:</Text>
              <Text style={styles.saleInfoValue}>{params.saleId || 'N/A'}</Text>
            </View>
            <View style={styles.saleInfoRow}>
              <Text style={styles.saleInfoLabel}>Payment:</Text>
              <Text style={styles.saleInfoValue}>
                {params.paymentMethod === 'cash' ? 'Cash' :
                 params.paymentMethod === 'card' ? 'Card' : 'Mobile Payment'}
              </Text>
            </View>
          </View>

          {/* Items */}
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>Items Purchased</Text>

            {cartItems.length === 0 ? (
              <Text style={styles.noItems}>No items in receipt</Text>
            ) : (
              cartItems.map((item) => (
                <View key={item.id} style={styles.receiptItem}>
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={2}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemBarcode}>
                      {item.barcode}
                    </Text>
                  </View>
                  <View style={styles.itemDetails}>
                    <Text style={styles.itemQuantity}>
                      {item.quantity}x
                    </Text>
                    <Text style={styles.itemPrice}>
                      ${item.price?.toFixed(2) || '0.00'}
                    </Text>
                    <Text style={styles.itemTotal}>
                      ${((item.quantity * item.price) || 0).toFixed(2)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Totals */}
          <View style={styles.totalsSection}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Subtotal:</Text>
              <Text style={styles.totalValue}>${getSubtotal().toFixed(2)}</Text>
            </View>

            {calculatedTaxes.length > 0 ? (
              calculatedTaxes.map((taxItem, index) => (
                <View key={index} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {taxItem.tax_name} ({taxItem.tax_rate.toFixed(1)}%):
                  </Text>
                  <Text style={styles.totalValue}>
                    ${taxItem.amount.toFixed(2)}
                  </Text>
                </View>
              ))
            ) : taxBreakdown.length > 0 ? (
              taxBreakdown.map((taxItem, index) => (
                <View key={index} style={styles.totalRow}>
                  <Text style={styles.totalLabel}>
                    {taxItem.tax_name} ({(taxItem.tax_rate * 100).toFixed(1)}%):
                  </Text>
                  <Text style={styles.totalValue}>
                    ${taxItem.tax_amount.toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Tax:</Text>
                <Text style={styles.totalValue}>${getTax().toFixed(2)}</Text>
              </View>
            )}

            <View style={[styles.totalRow, styles.finalTotalRow]}>
              <Text style={styles.finalTotalLabel}>Total:</Text>
              <Text style={styles.finalTotalValue}>${getTotal().toFixed(2)}</Text>
            </View>
          </View>

          {/* Footer Message */}
          <View style={styles.footerMessage}>
            <Text style={styles.thankYouText}>Thank you for your purchase!</Text>
            <Text style={styles.returnPolicy}>
              Returns accepted within 30 days with receipt
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Buttons */}
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.footerButton, styles.printButton]}
          onPress={handlePrintReceipt}
        >
          <MaterialIcons name="print" size={20} color="#007AFF" />
          <Text style={[styles.footerButtonText, styles.printButtonText]}>
            Print
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, styles.emailButton]}
          onPress={() => Alert.alert('Email', 'Email receipt feature would be implemented here')}
        >
          <MaterialIcons name="email" size={20} color="#007AFF" />
          <Text style={[styles.footerButtonText, styles.emailButtonText]}>
            Email
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.footerButton, styles.newSaleButton]}
          onPress={handleNewSale}
        >
          <MaterialIcons name="add" size={20} color="#fff" />
          <Text style={[styles.footerButtonText, styles.newSaleButtonText]}>
            New Sale
          </Text>
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  offlineIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  offlineText: {
    fontSize: 12,
    color: '#ff3b30',
    fontWeight: '600',
  },
  shareButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  receiptContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  receiptHeader: {
    alignItems: 'center',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  storeName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 12,
    marginBottom: 4,
  },
  storeAddress: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  receiptDate: {
    fontSize: 14,
    color: '#666',
  },
  saleInfo: {
    marginBottom: 24,
  },
  saleInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  saleInfoLabel: {
    fontSize: 16,
    color: '#666',
  },
  saleInfoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 16,
  },
  noItems: {
    textAlign: 'center',
    fontSize: 16,
    color: '#666',
    fontStyle: 'italic',
  },
  receiptItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemBarcode: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  itemDetails: {
    alignItems: 'flex-end',
  },
  itemQuantity: {
    fontSize: 14,
    color: '#666',
  },
  itemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  itemTotal: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginTop: 2,
  },
  totalsSection: {
    marginBottom: 24,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  totalLabel: {
    fontSize: 16,
    color: '#666',
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  finalTotalRow: {
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
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
  footerMessage: {
    alignItems: 'center',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  thankYouText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  returnPolicy: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
    padding: 20,
  },
  footerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    marginHorizontal: 4,
    gap: 6,
  },
  printButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  printButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  emailButton: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  emailButtonText: {
    color: '#007AFF',
    fontSize: 14,
    fontWeight: '600',
  },
  newSaleButton: {
    backgroundColor: '#007AFF',
  },
  newSaleButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  footerButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ReceiptScreen;
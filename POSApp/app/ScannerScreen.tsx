import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  ActivityIndicator,
  FlatList,
  Modal,
  TextInput,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { databaseService, Product } from '../services/database';
import { cartService, CartItem } from '../services/cartService';
import { scanProduct } from '../services/api';
import { syncService } from '../services/syncService';

const ScannerScreen = () => {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanning, setScanning] = useState(true);
  const [flashOn, setFlashOn] = useState(false);
  const [flashAvailable, setFlashAvailable] = useState(true);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [manualBarcode, setManualBarcode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingItemsCount, setPendingItemsCount] = useState(0);
  const [showUnknownProduct, setShowUnknownProduct] = useState(false);
  const [unknownProductData, setUnknownProductData] = useState<{
    barcode: string;
    product_name: string;
    selling_price: string;
  } | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    getCameraPermissions();
    loadCart();
    initializeDatabase();
    checkFlashAvailability();

    // Monitor network status and sync updates
    const unsubscribe = syncService.addSyncListener(async (status) => {
      setIsOnline(status.isOnline);
      if (status.isOnline) {
        // Refresh pending items count when back online
        await loadPendingItemsCount();
      }
    });

    // Load initial pending items count
    loadPendingItemsCount();

    return unsubscribe;
  }, []);

  // Debug effect to monitor flash state changes
  useEffect(() => {
    console.log('Flash state changed:', flashOn ? 'ON' : 'OFF');
    console.log('Flash available:', flashAvailable);
  }, [flashOn, flashAvailable]);

  const getCameraPermissions = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');

      if (status === 'granted') {
        console.log('Camera permission granted');
        // Check camera capabilities after permission is granted
        await checkCameraCapabilities();
      } else {
        console.log('Camera permission denied');
      }
    } catch (error) {
      console.error('Error requesting camera permissions:', error);
      setHasPermission(false);
    }
  };

  const checkCameraCapabilities = async () => {
    try {
      // Most modern mobile devices support flash when camera is available
      // We'll assume flash is available if camera permission is granted
      console.log('Camera capabilities check: assuming flash available');
      setFlashAvailable(true);
    } catch (error) {
      console.error('Error checking camera capabilities:', error);
      setFlashAvailable(false);
    }
  };

  const initializeDatabase = async () => {
    try {
      await databaseService.initialize();
    } catch (error) {
      console.error('Database initialization error:', error);
    }
  };

  const checkFlashAvailability = async () => {
    try {
      // Check if camera supports flash/torch
      const cameraPermissions = await Camera.getCameraPermissionsAsync();
      if (cameraPermissions.granted) {
        // Most modern devices support flash
        setFlashAvailable(true);
      } else {
        setFlashAvailable(false);
      }
    } catch (error) {
      console.error('Error checking flash availability:', error);
      setFlashAvailable(false);
    }
  };

  const loadCart = async () => {
    try {
      const items = await cartService.getCartItems();
      console.log('Cart loaded with items:', items.map(item => ({
        name: item.product.product_name,
        price: item.product.selling_price,
        quantity: item.quantity
      })));
      setCart(items);
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const loadPendingItemsCount = async () => {
    try {
      const pendingItems = await databaseService.getPendingScannedItems();
      setPendingItemsCount(pendingItems.length);
    } catch (error) {
      console.error('Error loading pending items count:', error);
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (!scanning) return;

    setScanning(false);
    setIsLoading(true);

    try {
      // First check local database for instant response
      let product = await databaseService.getProductByBarcode(data);

      // If not found locally and online, try API
      if (!product && isOnline) {
        try {
          product = await scanProduct(data);
          // Save to local database for future use
          if (product) {
            await databaseService.saveProducts([product]);
          }
        } catch (apiError) {
          console.log('API not available, using local only');
        }
      }

      if (product) {
        console.log('Product found:', {
          name: product.product_name || product.name,
          price: product.selling_price || product.price,
          barcode: product.barcode
        });

        // Ensure product has all required fields for Product interface
        const normalizedProduct: Product = {
          id: product.id || 0,
          barcode: product.barcode || '',
          product_name: product.product_name || product.name || '',
          selling_price: product.selling_price || product.price || 0,
          current_stock: product.current_stock || product.stock_quantity || 0,
          minimum_stock_level: product.minimum_stock_level || 0,
          is_active: product.is_active !== undefined ? product.is_active : true,
          date_created: product.date_created || new Date().toISOString(),
          date_modified: product.date_modified || new Date().toISOString(),
          category: product.category || '',
          brand: product.brand || '',
        };

        // Save scanned item for offline sync if needed
        if (!isOnline) {
          await databaseService.saveScannedItem({
            product_id: normalizedProduct.id,
            product_barcode: normalizedProduct.barcode,
            product_name: normalizedProduct.product_name,
            selling_price: normalizedProduct.selling_price,
            quantity: 1,
          });
        }

        await addProductToCart(normalizedProduct);
      } else {
        // Product not found in database - provide clear feedback
        if (!isOnline) {
          // For offline mode, immediately show the unknown product modal
          // so users can enter product details without interruption
          setUnknownProductData({
            barcode: data,
            product_name: '',
            selling_price: '',
          });
          setShowUnknownProduct(true);
        } else {
          // Online mode: Show enhanced notification about unknown product
          Alert.alert(
            'Product Not Found',
            `Barcode "${data}" was not found in the database.\n\nYou can:\n• Enter product details manually\n• Add it to your cart as a new item\n• Continue scanning other items`,
            [
              { text: 'Enter Details', style: 'default' },
              { text: 'Continue Scanning', style: 'cancel' }
            ]
          );

          // Show unknown product modal for manual entry
          setUnknownProductData({
            barcode: data,
            product_name: '',
            selling_price: '',
          });
          setShowUnknownProduct(true);
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      if (!isOnline) {
        // For offline mode, don't show error alerts - just log and continue
        console.log('Offline scan error - continuing:', error);
      } else {
        Alert.alert('Error', 'Failed to process barcode. Please try again.');
      }
    } finally {
      setIsLoading(false);
      // Resume scanning after a short delay
      setTimeout(() => setScanning(true), 2000);
    }
  };

  const addProductToCart = async (product: Product) => {
    try {
      await cartService.addToCart(product, 1);
      await loadCart(); // Refresh cart display

      // Show success feedback with offline context
      const isUnknownProduct = product.id < 0;
      Alert.alert(
        'Product Added',
        isUnknownProduct && !isOnline
          ? `${product.product_name} added to cart and saved for sync`
          : `${product.product_name} has been added to cart`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding to cart:', error);
      Alert.alert('Error', 'Failed to add product to cart');
    }
  };

  const handleManualEntry = async () => {
    if (!manualBarcode.trim()) {
      Alert.alert('Error', 'Please enter a barcode');
      return;
    }

    setIsLoading(true);
    try {
      // First check local database
      let product = await databaseService.getProductByBarcode(manualBarcode.trim());

      // If not found locally, try API
      if (!product) {
        try {
          product = await scanProduct(manualBarcode.trim());
          if (product) {
            await databaseService.saveProducts([product]);
          }
        } catch (apiError) {
          console.log('API not available');
        }
      }

      if (product) {
        // Ensure product has all required fields for Product interface
        const normalizedProduct: Product = {
          id: product.id || -Date.now(),
          barcode: product.barcode || manualBarcode.trim(),
          product_name: product.product_name || product.name || '',
          selling_price: product.selling_price || product.price || 0,
          current_stock: product.current_stock || 0,
          minimum_stock_level: product.minimum_stock_level || 0,
          is_active: product.is_active !== undefined ? product.is_active : true,
          date_created: product.date_created || new Date().toISOString(),
          date_modified: product.date_modified || new Date().toISOString(),
          category: product.category || '',
          brand: product.brand || '',
        };

        await addProductToCart(normalizedProduct);
        setShowManualEntry(false);
        setManualBarcode('');
      } else {
        if (!isOnline) {
          // Offline mode: Immediately show unknown product modal
          setUnknownProductData({
            barcode: manualBarcode.trim(),
            product_name: '',
            selling_price: '',
          });
          setShowUnknownProduct(true);
          setShowManualEntry(false);
        } else {
          // Online mode: Show unknown product modal for manual entry
          setUnknownProductData({
            barcode: manualBarcode.trim(),
            product_name: '',
            selling_price: '',
          });
          setShowUnknownProduct(true);
          setShowManualEntry(false);
        }
      }
    } catch (error) {
      console.error('Manual entry error:', error);
      if (!isOnline) {
        // For offline mode, don't show error alerts - just log and continue
        console.log('Offline manual entry error - continuing:', error);
      } else {
        Alert.alert('Error', 'Failed to find product. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnknownProductSubmit = async () => {
    if (!unknownProductData) return;

    if (!unknownProductData.product_name.trim()) {
      Alert.alert('Error', 'Please enter a product name');
      return;
    }

    const sellingPrice = parseFloat(unknownProductData.selling_price);
    if (isNaN(sellingPrice) || sellingPrice < 0) {
      Alert.alert('Error', 'Please enter a valid selling price');
      return;
    }

    setIsLoading(true);
    try {
      // Create a temporary product object for unknown products
      const tempProduct: Product = {
        id: -Date.now(), // Negative ID to indicate temporary product
        barcode: unknownProductData.barcode,
        product_name: unknownProductData.product_name.trim(),
        selling_price: sellingPrice,
        current_stock: 0,
        minimum_stock_level: 0,
        is_active: true,
        date_created: new Date().toISOString(),
        date_modified: new Date().toISOString(),
        category: '',
        brand: '',
      };

      // Save scanned item for potential future sync
      await databaseService.saveScannedItem({
        product_id: tempProduct.id,
        product_barcode: tempProduct.barcode,
        product_name: tempProduct.product_name,
        selling_price: tempProduct.selling_price,
        quantity: 1,
      });

      await addProductToCart(tempProduct);

      // Close modal and reset state
      setShowUnknownProduct(false);
      setUnknownProductData(null);

      // Show success notification with offline context
      Alert.alert(
        'Product Added Successfully',
        !isOnline
          ? `${tempProduct.product_name} added to cart and will be synced when online`
          : `${tempProduct.product_name} has been added to cart`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('Error adding unknown product:', error);
      if (!isOnline) {
        // For offline mode, don't show error alerts - just log and continue
        console.log('Offline unknown product error - continuing:', error);
      } else {
        Alert.alert('Error', 'Failed to add product. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (productId: number, newQuantity: number) => {
    try {
      await cartService.updateQuantity(productId, newQuantity);
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

  const getCartTotal = () => {
    return cart.reduce((total, item) => {
      const price = item.product.selling_price || 0;
      console.log(`Cart item: ${item.product.product_name}, price: ${price}`);
      return total + (price * item.quantity);
    }, 0);
  };

  const handleCheckout = () => {
    if (cart.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to cart before checkout.');
      return;
    }
    router.push('/CheckoutScreen');
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.permissionText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <MaterialIcons name="camera-alt" size={64} color="#ccc" />
          <Text style={styles.permissionText}>Camera access denied</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={getCameraPermissions}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
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
          <View style={styles.offlineBannerContent}>
            <Text style={styles.offlineBannerText}>
              Working Offline - All scans saved locally
            </Text>
            {pendingItemsCount > 0 && (
              <Text style={styles.offlineBannerSubtext}>
                {pendingItemsCount} items will sync when online
              </Text>
            )}
          </View>
        </View>
      )}

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#007AFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>New Sale</Text>
          {!isOnline && (
            <View style={styles.offlineIndicator}>
              <MaterialIcons name="wifi-off" size={14} color="#ff3b30" />
              <Text style={styles.offlineText}>Offline</Text>
            </View>
          )}
        </View>
        <TouchableOpacity
          onPress={() => {
            if (flashAvailable) {
              const newFlashState = !flashOn;
              console.log('Flash toggled:', newFlashState ? 'ON' : 'OFF');
              setFlashOn(newFlashState);
            } else {
              console.log('Flash not available on this device');
              Alert.alert('Flash Not Available', 'Flash is not available on this device.');
            }
          }}
          style={[styles.flashButton, !flashAvailable && styles.flashButtonDisabled]}
        >
          <Text style={[styles.flashIcon, flashAvailable ? styles.flashIconActive : styles.flashIconInactive]}>
            ⚡
          </Text>
        </TouchableOpacity>
      </View>

      {/* Camera Viewfinder (60% of screen) */}
      <View style={styles.cameraContainer}>
        <CameraView
          ref={cameraRef}
          style={styles.camera}
          facing="back"
          flash={flashOn ? "on" : "off"}
          mode="picture"
          onBarcodeScanned={handleBarcodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ["ean13", "ean8", "code128", "qr"],
          }}
        >
          <View style={styles.cameraOverlay}>
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
            </View>
            <TouchableOpacity
              style={styles.manualEntryButton}
              onPress={() => setShowManualEntry(true)}
            >
              <MaterialIcons name="keyboard" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </CameraView>
      </View>

      {/* Shopping Cart (40% of screen) */}
      <View style={styles.cartContainer}>
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>Shopping Cart ({cart.length} items)</Text>
          <Text style={styles.cartTotal}>${getCartTotal().toFixed(2)}</Text>
        </View>

        {cart.length === 0 ? (
          <View style={styles.emptyCart}>
            <MaterialIcons name="shopping-cart" size={48} color="#ccc" />
            <Text style={styles.emptyCartText}>Scan items to add to cart</Text>
          </View>
        ) : (
          <FlatList
            data={cart}
            keyExtractor={(item) => item.id}
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.cartItem}>
                <View style={styles.cartItemInfo}>
                  <View style={styles.cartItemHeader}>
                    <Text style={styles.cartItemName} numberOfLines={1}>
                      {item.product.product_name}
                    </Text>
                    {item.product.id < 0 && (
                      <View style={styles.unknownProductBadge}>
                        <Text style={styles.unknownProductText}>NEW</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.cartItemPrice}>
                    ${item.product.selling_price?.toFixed(2) || '0.00'} each
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
        )}
      </View>

      {/* Sticky Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom }]}>
        <TouchableOpacity
          style={[styles.footerButton, styles.cancelButton]}
          onPress={() => router.back()}
        >
          <Text style={[styles.footerButtonText, styles.cancelButtonText]}>Cancel Sale</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.footerButton, styles.checkoutButton]}
          onPress={handleCheckout}
        >
          <Text style={[styles.footerButtonText, styles.checkoutButtonText]}>
            Checkout (${getCartTotal().toFixed(2)})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Manual Entry Modal */}
      <Modal
        visible={showManualEntry}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowManualEntry(false)}>
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Manual Entry</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.modalContent}>
            <Text style={styles.modalLabel}>Enter Barcode:</Text>
            <TextInput
              style={styles.barcodeInput}
              value={manualBarcode}
              onChangeText={setManualBarcode}
              placeholder="Scan barcode or enter manually"
              keyboardType="numeric"
              autoFocus
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleManualEntry}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add Product</Text>
              )}
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Unknown Product Modal */}
      <Modal
        visible={showUnknownProduct}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowUnknownProduct(false)}>
              <MaterialIcons name="close" size={24} color="#007AFF" />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>New Product</Text>
            <View style={styles.placeholder} />
          </View>

          <View style={styles.modalContent}>
            <View style={styles.infoBox}>
              <MaterialIcons name="info-outline" size={20} color="#007AFF" />
              <Text style={styles.infoText}>
                This product isn't in the database. Enter the details below to add it to your cart.
              </Text>
            </View>

            <Text style={styles.modalLabel}>Barcode:</Text>
            <TextInput
              style={[styles.barcodeInput, styles.disabledInput]}
              value={unknownProductData?.barcode || ''}
              editable={false}
              placeholder="Scanned barcode"
            />

            <Text style={styles.modalLabel}>Product Name: *</Text>
            <TextInput
              style={styles.barcodeInput}
              value={unknownProductData?.product_name || ''}
              onChangeText={(text) =>
                setUnknownProductData(prev =>
                  prev ? { ...prev, product_name: text } : null
                )
              }
              placeholder="Enter product name (required)"
              autoFocus
            />

            <Text style={styles.modalLabel}>Selling Price: *</Text>
            <TextInput
              style={styles.barcodeInput}
              value={unknownProductData?.selling_price || ''}
              onChangeText={(text) =>
                setUnknownProductData(prev =>
                  prev ? { ...prev, selling_price: text } : null
                )
              }
              placeholder="0.00"
              keyboardType="decimal-pad"
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleUnknownProductSubmit}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Add to Cart</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => setShowUnknownProduct(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Loading Overlay */}
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.loadingText}>Processing...</Text>
        </View>
      )}
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
  permissionText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
    textAlign: 'center',
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  permissionButtonText: {
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
  pendingCount: {
    fontSize: 12,
    color: '#ff9500',
    fontWeight: '500',
  },
  flashButton: {
    padding: 8,
  },
  flashButtonDisabled: {
    opacity: 0.5,
  },
  flashIcon: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  flashIconActive: {
    color: '#007AFF',
  },
  flashIconInactive: {
    color: '#ccc',
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
  offlineBannerContent: {
    alignItems: 'center',
  },
  offlineBannerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
    textAlign: 'center',
  },
  offlineBannerSubtext: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
    textAlign: 'center',
  },
  cameraContainer: {
    flex: 0.6,
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scannerFrame: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#fff',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  manualEntryButton: {
    position: 'absolute',
    top: 20,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    padding: 12,
    borderRadius: 25,
  },
  cartContainer: {
    flex: 0.4,
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e1e1e1',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  cartTotal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  emptyCart: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyCartText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
  },
  cartList: {
    flex: 1,
  },
  cartItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    backgroundColor: '#f8f9fa',
    marginBottom: 8,
    borderRadius: 8,
  },
  cartItemInfo: {
    flex: 1,
  },
  cartItemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 2,
  },
  cartItemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  cartItemPrice: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  unknownProductBadge: {
    backgroundColor: '#ff9500',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    marginLeft: 8,
  },
  unknownProductText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
    backgroundColor: '#fff',
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
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ff3b30',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e1e1',
  },
  footerButton: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footerButtonText: {
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
  modalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  barcodeInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 20,
  },
  disabledInput: {
    backgroundColor: '#f5f5f5',
    color: '#666',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  cancelButton: {
    backgroundColor: 'transparent',
    paddingVertical: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
    borderWidth: 1,
    borderColor: '#ccc',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 8,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
  },
  infoText: {
    fontSize: 14,
    color: '#333',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 12,
  },
});

export default ScannerScreen;
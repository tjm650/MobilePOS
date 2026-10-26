import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Alert,
  Modal,
  Dimensions,
} from 'react-native';
import { SafeAreaFrameContext, SafeAreaView } from 'react-native-safe-area-context';
import type { Edge } from 'react-native-safe-area-context';
import { StackNavigationProp } from '@react-navigation/stack';
import { Camera, useCameraDevices } from 'react-native-vision-camera';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList, RootStackParamList } from '../navigation/AppNavigator';
import CartItem from '../components/CartItem';
import { scanProduct, addToCart, getCartTotal } from '../services/cartService';

type ScannerScreenNavigationProp = StackNavigationProp<MainTabParamList, 'Scanner'>;

interface Props {
  navigation: ScannerScreenNavigationProp;
}

interface CartItemType {
  id: string;
  product: {
    id: number;
    name: string;
    price: number;
    barcode: string;
  };
  quantity: number;
  totalPrice: number;
}

const { width, height } = Dimensions.get('window');

const ScannerScreen: React.FC<Props> = ({ navigation }) => {
  const [hasPermission, setHasPermission] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [cartItems, setCartItems] = useState<CartItemType[]>([]);
  const [cartTotal, setCartTotal] = useState(0);
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [scanning, setScanning] = useState(false);
  const camera = useRef<Camera>(null);
  const devices = useCameraDevices();
  const device = devices.back;

  useEffect(() => {
    requestCameraPermission();
  }, []);

  useEffect(() => {
    // Update cart total whenever cart items change
    const total = getCartTotal(cartItems);
    setCartTotal(total);
  }, [cartItems]);

  const requestCameraPermission = async () => {
    try {
      const permission = await Camera.requestCameraPermission();
      setHasPermission(permission === 'authorized');
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      Alert.alert('Error', 'Failed to request camera permission');
    }
  };

  const handleBarcodeDetected = async (barcode: string) => {
    if (scanning) return;

    setScanning(true);
    try {
      const product = await scanProduct(barcode);

      if (product) {
        const newItem = addToCart(cartItems, product);
        setCartItems([...newItem]);
      } else {
        // Create placeholder item if not found
        const placeholder = {
          id: Date.now(),
          name: `Item ${barcode}`,
          price: 0,
          barcode,
        } as any;
        const newItem = addToCart(cartItems, placeholder);
        setCartItems([...newItem]);
        Alert.alert(
          'Product Not in Database',
          `Barcode ${barcode} was not found. Added as a custom item with price $0.00.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      // On any scan error, allow adding a placeholder item with entered barcode
      const placeholder = {
        id: Date.now(),
        name: `Item ${barcode}`,
        price: 0,
        barcode,
      } as any;
      const newItem = addToCart(cartItems, placeholder);
      setCartItems([...newItem]);
      Alert.alert(
        'Product Not in Database',
        `Could not fetch product for barcode ${barcode}. Added as a custom item with price $0.00.`,
        [{ text: 'OK' }]
      );
    } finally {
      setScanning(false);
    }
  };

  const handleManualEntry = () => {
    navigation.navigate('ManualEntry', {
      onBarcodeScanned: (code: string) => {
        // Try scan first; on failure add placeholder immediately
        handleBarcodeDetected(code);
      },
    });
  };

  const removeFromCart = (itemId: string) => {
    const updatedCart = cartItems.filter(item => item.id !== itemId);
    setCartItems(updatedCart);
  };

  const updateQuantity = (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(itemId);
      return;
    }

    const updatedCart = cartItems.map(item =>
      item.id === itemId
        ? { ...item, quantity: newQuantity, totalPrice: item.product.price * newQuantity }
        : item
    );
    setCartItems(updatedCart);
  };

  const clearCart = () => {
    Alert.alert(
      'Clear Cart',
      'Are you sure you want to clear all items?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: () => setCartItems([]) },
      ]
    );
  };

  const proceedToCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert('Empty Cart', 'Please add items to the cart before checkout');
      return;
    }

    navigation.navigate('Checkout', {
      cartItems,
      total: cartTotal,
    });
  };

  const renderCartItem = ({ item }: { item: CartItemType }) => (
    <CartItem
      item={item}
      onUpdateQuantity={updateQuantity}
      onRemove={removeFromCart}
    />
  );

  if (!hasPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.permissionContainer}>
          <Icon name="camera-alt" size={64} color="#ccc" />
          <Text style={styles.permissionText}>Camera permission is required</Text>
          <TouchableOpacity style={styles.permissionButton} onPress={requestCameraPermission}>
            <Text style={styles.permissionButtonText}>Grant Permission</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (device == null) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading camera...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaFrameContext>

    <SafeAreaView style={styles.container}>
      {/* Camera Section */}
      <View style={styles.cameraContainer}>
        <Camera
          ref={camera}
          style={styles.camera}
          device={device}
          isActive={isActive}
          photo={false}
          video={false}
          audio={false}
        />

        {/* Camera Controls */}
        <View style={styles.cameraControls}>
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => setIsActive(!isActive)}
          >
            <Icon
              name={isActive ? 'pause' : 'play-arrow'}
              size={24}
              color="#fff"
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.manualEntryButton}
            onPress={handleManualEntry}
          >
            <Icon name="keyboard" size={20} color="#007AFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.flashButton}>
            <Icon name="flash-off" size={20} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Scanning Indicator */}
        {scanning && (
          <View style={styles.scanningOverlay}>
            <Text style={styles.scanningText}>Scanning...</Text>
          </View>
        )}
      </View>

      {/* Cart Section */}
      <View style={styles.cartContainer}>
        {/* Cart Header */}
        <View style={styles.cartHeader}>
          <Text style={styles.cartTitle}>
            Shopping Cart ({cartItems.length} items)
          </Text>
          <TouchableOpacity onPress={clearCart} disabled={cartItems.length === 0}>
            <Icon
              name="clear-all"
              size={24}
              color={cartItems.length > 0 ? '#FF6B35' : '#ccc'}
            />
          </TouchableOpacity>
        </View>

        {/* Cart Items */}
        {cartItems.length > 0 ? (
          <FlatList
            data={cartItems}
            renderItem={renderCartItem}
            keyExtractor={(item) => item.id}
            style={styles.cartList}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <View style={styles.emptyCart}>
            <Icon name="shopping-cart" size={64} color="#ccc" />
            <Text style={styles.emptyCartText}>Scan items to add to cart</Text>
          </View>
        )}

        {/* Cart Footer */}
        {cartItems.length > 0 && (
          <View style={styles.cartFooter}>
            <View style={styles.totalContainer}>
              <Text style={styles.totalLabel}>Total:</Text>
              <Text style={styles.totalAmount}>${cartTotal.toFixed(2)}</Text>
            </View>

            <TouchableOpacity
              style={styles.checkoutButton}
              onPress={proceedToCheckout}
            >
              <Text style={styles.checkoutButtonText}>Checkout</Text>
              <Icon name="arrow-forward" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
    </SafeAreaFrameContext>
  );
};

const styles = StyleSheet.create({
  container: {
    // flex: 1,
    backgroundColor: '#f5f5f5',
    paddingBottom: "20%",
    marginBottom:50
  },
  cameraContainer: {
    height: height * 0.6,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    top: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  controlButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 25,
    width: 50,
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manualEntryButton: {
    backgroundColor: '#fff',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flashButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 122, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanningText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: '600',
  },
  cartContainer: {
    // flex: 1,
    backgroundColor: '#fff',
  },
  cartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  cartTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  cartList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  emptyCart: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCartText: {
    fontSize: 16,
    color: '#666',
    marginTop: 16,
  },
  cartFooter: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingHorizontal: 20,
    paddingVertical: 16,
    // paddingBottom: 100, // Extra padding to avoid bottom navigation overlap
    marginBottom:50
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  totalLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  checkoutButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  checkoutButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  permissionContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  permissionText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
    marginTop: 16,
    marginBottom: 24,
  },
  permissionButton: {
    backgroundColor: '#007AFF',
    borderRadius: 8,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  permissionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ScannerScreen;
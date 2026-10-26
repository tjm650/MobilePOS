import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface CartItemProps {
  item: {
    id: string;
    product: {
      id: number;
      name: string;
      price: number;
      barcode: string;
      stock_quantity: number;
    };
    quantity: number;
    totalPrice: number;
  };
  onUpdateQuantity: (itemId: string, newQuantity: number) => void;
  onRemove: (itemId: string) => void;
}

const CartItem: React.FC<CartItemProps> = ({
  item,
  onUpdateQuantity,
  onRemove,
}) => {
  const scaleValue = React.useRef(new Animated.Value(1)).current;

  const handleIncrement = () => {
    onUpdateQuantity(item.id, item.quantity + 1);
    animateButton();
  };

  const handleDecrement = () => {
    if (item.quantity > 1) {
      onUpdateQuantity(item.id, item.quantity - 1);
      animateButton();
    }
  };

  const handleRemove = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onRemove(item.id);
    });
  };

  const animateButton = () => {
    Animated.sequence([
      Animated.timing(scaleValue, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scaleValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const isLowStock = ((item.product as any).stock_quantity ?? (item.product as any).current_stock ?? 0) <= 5;

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ scale: scaleValue }],
        },
      ]}
    >
      {/* Product Info */}
      <View style={styles.productInfo}>
        <View style={styles.textContainer}>
          <Text style={styles.productName} numberOfLines={2}>
            {item.product.name}
          </Text>
          <Text style={styles.productBarcode}>{item.product.barcode}</Text>
          {isLowStock && (
            <View style={styles.lowStockWarning}>
              <Icon name="warning" size={12} color="#FF6B35" />
              <Text style={styles.lowStockText}>
                Only {item.product.stock_quantity} left
              </Text>
            </View>
          )}
        </View>

        <View style={styles.priceContainer}>
          <Text style={styles.unitPrice}>
            ${Number((item.product as any).price ?? (item.product as any).price ?? 0).toFixed(2)}
          </Text>
          <Text style={styles.totalPrice}>
            ${item.totalPrice.toFixed(2)}
          </Text>
        </View>
      </View>

      {/* Quantity Controls */}
      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, item.quantity <= 1 && styles.disabledButton]}
          onPress={handleDecrement}
          disabled={item.quantity <= 1}
        >
          <Icon
            name="remove"
            size={16}
            color={item.quantity <= 1 ? '#ccc' : '#007AFF'}
          />
        </TouchableOpacity>

        <View style={styles.quantityContainer}>
          <Text style={styles.quantityText}>{item.quantity}</Text>
        </View>

        <TouchableOpacity
          style={styles.controlButton}
          onPress={handleIncrement}
        >
          <Icon name="add" size={16} color="#007AFF" />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={handleRemove}
        >
          <Icon name="delete" size={16} color="#FF6B35" />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
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
  productInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productBarcode: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  lowStockWarning: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  lowStockText: {
    fontSize: 11,
    color: '#FF6B35',
    marginLeft: 4,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  unitPrice: {
    fontSize: 12,
    color: '#666',
  },
  totalPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  controlsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f8f9fa',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
  },
  disabledButton: {
    backgroundColor: '#f0f0f0',
    borderColor: '#ccc',
  },
  quantityContainer: {
    backgroundColor: '#007AFF',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    minWidth: 50,
    alignItems: 'center',
  },
  quantityText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#fff5f5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FF6B35',
  },
});

export default CartItem;
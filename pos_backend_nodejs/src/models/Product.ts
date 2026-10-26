import mongoose, { Document, Schema } from 'mongoose';

export interface IProduct extends Document {
  barcode: string;
  name: string;
  description?: string;
  category: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  minimumStockLevel: number;
  isActive: boolean;
  isLowStock: boolean;
  profitMargin: number;
  storeId: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema: Schema = new Schema({
  barcode: {
    type: String,
    required: [true, 'Barcode is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [100, 'Product name cannot exceed 100 characters']
  },
  description: {
    type: String,
    trim: true,
    maxlength: [500, 'Description cannot exceed 500 characters']
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  costPrice: {
    type: Number,
    required: [true, 'Cost price is required'],
    min: [0, 'Cost price cannot be negative']
  },
  stockQuantity: {
    type: Number,
    required: [true, 'Stock quantity is required'],
    min: [0, 'Stock quantity cannot be negative'],
    default: 0
  },
  minimumStockLevel: {
    type: Number,
    required: [true, 'Minimum stock level is required'],
    min: [0, 'Minimum stock level cannot be negative'],
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  },
  isLowStock: {
    type: Boolean,
    default: false
  },
  profitMargin: {
    type: Number,
    default: 0
  },
  storeId: {
    type: String,
    required: [true, 'Store ID is required']
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Created by user is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
ProductSchema.index({ name: 'text', description: 'text' });
ProductSchema.index({ category: 1 });
ProductSchema.index({ storeId: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ isLowStock: 1 });

// Virtual for profit margin calculation
ProductSchema.virtual('calculatedProfitMargin').get(function() {
  const doc = this as any;
  if (doc.costPrice > 0) {
    return ((doc.price - doc.costPrice) / doc.costPrice) * 100;
  }
  return 0;
});

// Pre-save middleware to calculate profit margin and check low stock
ProductSchema.pre('save', function(next) {
  const doc = this as any;
  // Calculate profit margin
  if (doc.costPrice > 0) {
    doc.profitMargin = ((doc.price - doc.costPrice) / doc.costPrice) * 100;
  }

  // Check if product is low on stock
  doc.isLowStock = doc.stockQuantity <= doc.minimumStockLevel;

  next();
});

// Static method to find products by store
ProductSchema.statics.findByStore = function(storeId: string) {
  return this.find({ storeId, isActive: true });
};

// Static method to find low stock products by store
ProductSchema.statics.findLowStockByStore = function(storeId: string) {
  return this.find({
    storeId,
    isActive: true,
    stockQuantity: { $lte: '$minimumStockLevel' }
  });
};

// Static method to search products
ProductSchema.statics.searchProducts = function(storeId: string, query: string) {
  return this.find({
    storeId,
    isActive: true,
    $text: { $search: query }
  });
};

// Instance method to update stock
ProductSchema.methods.updateStock = function(quantity: number): number {
  this.stockQuantity += quantity;
  this.isLowStock = this.stockQuantity <= this.minimumStockLevel;
  return this.stockQuantity;
};

// Instance method to check if product is available
ProductSchema.methods.isAvailable = function(quantity: number = 1): boolean {
  return this.stockQuantity >= quantity;
};

export default mongoose.model<IProduct>('Product', ProductSchema);
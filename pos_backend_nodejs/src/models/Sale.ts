import mongoose, { Document, Schema } from 'mongoose';

export interface ISaleItem extends Document {
  product: mongoose.Types.ObjectId;
  productName: string;
  productBarcode: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  sale: mongoose.Types.ObjectId;
}

export interface ISale extends Document {
  saleNumber: string;
  cashier: mongoose.Types.ObjectId;
  storeId: string;
  items: ISaleItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  totalAmount: number;
  paymentMethod: 'cash' | 'card' | 'mobile' | 'other';
  status: 'pending' | 'completed' | 'cancelled' | 'refunded';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
}

const SaleItemSchema: Schema = new Schema({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: [true, 'Product is required']
  },
  productName: {
    type: String,
    required: [true, 'Product name is required']
  },
  productBarcode: {
    type: String,
    required: [true, 'Product barcode is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  totalPrice: {
    type: Number,
    required: [true, 'Total price is required'],
    min: [0, 'Total price cannot be negative']
  },
  sale: {
    type: Schema.Types.ObjectId,
    ref: 'Sale',
    required: [true, 'Sale reference is required']
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

const SaleSchema: Schema = new Schema({
  saleNumber: {
    type: String,
    unique: true,
    required: [true, 'Sale number is required']
  },
  cashier: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Cashier is required']
  },
  storeId: {
    type: String,
    required: [true, 'Store ID is required']
  },
  items: [{
    type: Schema.Types.ObjectId,
    ref: 'SaleItem'
  }],
  subtotal: {
    type: Number,
    required: [true, 'Subtotal is required'],
    min: [0, 'Subtotal cannot be negative']
  },
  taxAmount: {
    type: Number,
    default: 0,
    min: [0, 'Tax amount cannot be negative']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'mobile', 'other'],
    default: 'cash'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'cancelled', 'refunded'],
    default: 'pending'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  completedAt: {
    type: Date
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
SaleSchema.index({ cashier: 1 });
SaleSchema.index({ storeId: 1 });
SaleSchema.index({ status: 1 });
SaleSchema.index({ createdAt: -1 });
SaleSchema.index({ completedAt: -1 });

// Pre-save middleware to calculate totals
SaleSchema.pre('save', function(next) {
  const doc = this as any;
  if (doc.isModified('subtotal') || doc.isModified('taxAmount') || doc.isModified('discountAmount')) {
    doc.totalAmount = (doc.subtotal as number) + (doc.taxAmount as number) - (doc.discountAmount as number);
  }

  if (doc.status === 'completed' && !doc.completedAt) {
    doc.completedAt = new Date();
  }

  next();
});

// Virtual for item count
SaleSchema.virtual('itemCount').get(function() {
  return (this as any).items.length;
});

// Static method to generate sale number
SaleSchema.statics.generateSaleNumber = function(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-4);
  return `S${year}${month}${day}${timestamp}`;
};

// Static method to find sales by store
SaleSchema.statics.findByStore = function(storeId: string, status?: string) {
  const query: any = { storeId };
  if (status) {
    query.status = status;
  }
  return this.find(query).populate('cashier', 'username firstName lastName').sort({ createdAt: -1 });
};

// Static method to get today's sales stats
SaleSchema.statics.getTodayStats = function(storeId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return this.aggregate([
    {
      $match: {
        storeId,
        status: 'completed',
        createdAt: { $gte: today, $lt: tomorrow }
      }
    },
    {
      $group: {
        _id: null,
        totalSales: { $sum: '$totalAmount' },
        transactionCount: { $sum: 1 },
        averageSale: { $avg: '$totalAmount' }
      }
    }
  ]);
};

// Instance method to add item
SaleSchema.methods.addItem = function(saleItem: Partial<ISaleItem>) {
  this.items.push(saleItem);
  this.recalculateTotals();
};

// Instance method to remove item
SaleSchema.methods.removeItem = function(itemId: string) {
  const doc = this as any;
  doc.items = doc.items.filter((item: any) => item._id.toString() !== itemId);
  this.recalculateTotals();
};

// Instance method to recalculate totals
SaleSchema.methods.recalculateTotals = function() {
  const doc = this as any;
  doc.subtotal = doc.items.reduce((sum: number, item: any) => sum + item.totalPrice, 0);
  doc.totalAmount = doc.subtotal + doc.taxAmount - doc.discountAmount;
};

export const SaleItem = mongoose.model<ISaleItem>('SaleItem', SaleItemSchema);
export default mongoose.model<ISale>('Sale', SaleSchema);
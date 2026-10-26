import mongoose, { Document, Schema } from 'mongoose';

export interface IInventoryTransaction extends Document {
  product: mongoose.Types.ObjectId;
  productName: string;
  productBarcode: string;
  transactionType: 'addition' | 'removal' | 'adjustment' | 'sale' | 'return' | 'damage' | 'theft';
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reference?: string;
  notes?: string;
  storeId: string;
  createdBy: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const InventoryTransactionSchema: Schema = new Schema({
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
  transactionType: {
    type: String,
    enum: ['addition', 'removal', 'adjustment', 'sale', 'return', 'damage', 'theft'],
    required: [true, 'Transaction type is required']
  },
  quantityChange: {
    type: Number,
    required: [true, 'Quantity change is required']
  },
  previousQuantity: {
    type: Number,
    required: [true, 'Previous quantity is required'],
    min: [0, 'Previous quantity cannot be negative']
  },
  newQuantity: {
    type: Number,
    required: [true, 'New quantity is required'],
    min: [0, 'New quantity cannot be negative']
  },
  reference: {
    type: String,
    trim: true,
    maxlength: [100, 'Reference cannot exceed 100 characters']
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
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
InventoryTransactionSchema.index({ product: 1 });
InventoryTransactionSchema.index({ storeId: 1 });
InventoryTransactionSchema.index({ createdBy: 1 });
InventoryTransactionSchema.index({ transactionType: 1 });
InventoryTransactionSchema.index({ createdAt: -1 });
InventoryTransactionSchema.index({ product: 1, createdAt: -1 });

// Virtual for absolute quantity change
InventoryTransactionSchema.virtual('absoluteQuantityChange').get(function() {
  return Math.abs(this.quantityChange as number);
});

// Static method to find transactions by store
InventoryTransactionSchema.statics.findByStore = function(storeId: string, limit?: number) {
  const query = this.find({ storeId }).populate('product', 'name barcode').populate('createdBy', 'username firstName lastName').sort({ createdAt: -1 });

  if (limit) {
    query.limit(limit);
  }

  return query;
};

// Static method to find transactions by product
InventoryTransactionSchema.statics.findByProduct = function(productId: string) {
  return this.find({ product: productId }).populate('createdBy', 'username firstName lastName').sort({ createdAt: -1 });
};

// Static method to get inventory summary for a product
InventoryTransactionSchema.statics.getProductSummary = function(productId: string) {
  return this.aggregate([
    { $match: { product: new mongoose.Types.ObjectId(productId) } },
    {
      $group: {
        _id: '$product',
        totalAdditions: {
          $sum: { $cond: [{ $gt: ['$quantityChange', 0] }, '$quantityChange', 0] }
        },
        totalRemovals: {
          $sum: { $cond: [{ $lt: ['$quantityChange', 0] }, '$quantityChange', 0] }
        },
        transactionCount: { $sum: 1 },
        lastTransaction: { $max: '$createdAt' }
      }
    }
  ]);
};

// Static method to get store inventory summary
InventoryTransactionSchema.statics.getStoreSummary = function(storeId: string, startDate?: Date, endDate?: Date) {
  const matchStage: any = { storeId };

  if (startDate || endDate) {
    matchStage.createdAt = {};
    if (startDate) matchStage.createdAt.$gte = startDate;
    if (endDate) matchStage.createdAt.$lte = endDate;
  }

  return this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$transactionType',
        totalQuantity: { $sum: '$quantityChange' },
        transactionCount: { $sum: 1 }
      }
    },
    { $sort: { totalQuantity: -1 } }
  ]);
};

// Instance method to reverse transaction
InventoryTransactionSchema.methods.reverse = function() {
  this.quantityChange = -this.quantityChange;
  this.transactionType = this.transactionType + '_reversed';
  return this.save();
};

export default mongoose.model<IInventoryTransaction>('InventoryTransaction', InventoryTransactionSchema);
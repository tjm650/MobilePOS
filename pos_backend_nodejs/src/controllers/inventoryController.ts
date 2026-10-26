import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import Product from '../models/Product';
import InventoryTransaction from '../models/InventoryTransaction';
import { asyncHandler, createError } from '../middleware/errorHandler';

export const updateInventoryValidation = [
  body('product_id')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('quantity_change')
    .isNumeric()
    .withMessage('Quantity change must be a number')
    .toInt(),
  body('transaction_type')
    .optional()
    .isIn(['addition', 'removal', 'adjustment', 'sale', 'return', 'damage', 'theft'])
    .withMessage('Invalid transaction type')
];

export const getTransactionsValidation = [
  body('limit')
    .optional()
    .isNumeric()
    .withMessage('Limit must be a number')
    .toInt()
];

// Update inventory
export const updateInventory = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }

  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { product_id, quantity_change, transaction_type = 'adjustment' } = req.body;

  try {
    // Find product
    const product = await Product.findOne({
      _id: product_id,
      isActive: true,
      storeId: user.storeId
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    // Calculate new quantity
    const previousQuantity = product.stockQuantity;
    const newQuantity = previousQuantity + quantity_change;

    if (newQuantity < 0) {
      res.status(400).json({
        success: false,
        error: 'Insufficient stock for this operation'
      });
      return;
    }

    // Update product stock
    product.stockQuantity = newQuantity;
    product.isLowStock = newQuantity <= product.minimumStockLevel;
    await product.save();

    // Create inventory transaction record
    const transaction = await InventoryTransaction.create({
      product: product._id,
      productName: product.name,
      productBarcode: product.barcode,
      transactionType: transaction_type,
      quantityChange: quantity_change,
      previousQuantity,
      newQuantity,
      storeId: user.storeId,
      createdBy: user._id
    });

    res.status(200).json({
      success: true,
      type: 'inventory_update_success',
      product_id: product._id,
      new_stock: product.stockQuantity,
      transaction: {
        id: transaction._id,
        transactionType: transaction.transactionType,
        quantityChange: transaction.quantityChange,
        previousQuantity: transaction.previousQuantity,
        newQuantity: transaction.newQuantity,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    throw createError('Error updating inventory', 500);
  }
});

// Get inventory transactions
export const getInventoryTransactions = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { limit = 50 } = req.query;

  const transactions = await InventoryTransaction.find({ storeId: user.storeId })
    .populate('product', 'name barcode')
    .populate('createdBy', 'username firstName lastName')
    .sort({ createdAt: -1 })
    .limit(parseInt(limit as string));

  res.status(200).json({
    success: true,
    count: transactions.length,
    data: transactions
  });
});

// Get inventory summary
export const getInventorySummary = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  try {
    // Get total products count
    const totalProducts = await Product.countDocuments({
      isActive: true,
      storeId: user.storeId
    });

    // Get low stock products count
    const lowStockProducts = await Product.countDocuments({
      isActive: true,
      storeId: user.storeId,
      isLowStock: true
    });

    // Get out of stock products count
    const outOfStockProducts = await Product.countDocuments({
      isActive: true,
      storeId: user.storeId,
      stockQuantity: 0
    });

    // Calculate total inventory value
    const inventoryValueResult = await Product.aggregate([
      {
        $match: {
          isActive: true,
          storeId: user.storeId
        }
      },
      {
        $group: {
          _id: null,
          totalValue: {
            $sum: { $multiply: ['$stockQuantity', '$price'] }
          }
        }
      }
    ]);

    const totalInventoryValue = inventoryValueResult.length > 0 ? inventoryValueResult[0].totalValue : 0;

    // Get recent transactions summary
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const recentTransactions = await InventoryTransaction.aggregate([
      {
        $match: {
          storeId: user.storeId,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: '$transactionType',
          totalQuantity: { $sum: '$quantityChange' },
          transactionCount: { $sum: 1 }
        }
      },
      { $sort: { totalQuantity: -1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalProducts,
        lowStockProducts,
        outOfStockProducts,
        totalInventoryValue,
        recentTransactionsSummary: recentTransactions,
        summaryPeriod: 'Last 30 days'
      }
    });
  } catch (error) {
    throw createError('Error getting inventory summary', 500);
  }
});

// Adjust stock (convenience method)
export const adjustStock = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { product_id, new_quantity, notes } = req.body;

  if (new_quantity === undefined || new_quantity < 0) {
    res.status(400).json({
      success: false,
      error: 'New quantity must be provided and cannot be negative'
    });
    return;
  }

  try {
    // Find product
    const product = await Product.findOne({
      _id: product_id,
      isActive: true,
      storeId: user.storeId
    });

    if (!product) {
      res.status(404).json({
        success: false,
        error: 'Product not found'
      });
      return;
    }

    const quantityChange = new_quantity - product.stockQuantity;

    if (quantityChange === 0) {
      res.status(400).json({
        success: false,
        error: 'No change in quantity'
      });
      return;
    }

    // Update product stock
    product.stockQuantity = new_quantity;
    product.isLowStock = new_quantity <= product.minimumStockLevel;
    await product.save();

    // Create inventory transaction record
    await InventoryTransaction.create({
      product: product._id,
      productName: product.name,
      productBarcode: product.barcode,
      transactionType: 'adjustment',
      quantityChange,
      previousQuantity: product.stockQuantity - quantityChange,
      newQuantity: product.stockQuantity,
      reference: notes || 'Stock adjustment',
      storeId: user.storeId,
      createdBy: user._id
    });

    res.status(200).json({
      success: true,
      message: 'Stock adjusted successfully',
      data: {
        product_id: product._id,
        previous_quantity: product.stockQuantity - quantityChange,
        new_quantity: product.stockQuantity,
        change: quantityChange
      }
    });
  } catch (error) {
    throw createError('Error adjusting stock', 500);
  }
});
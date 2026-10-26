import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export const completeSaleValidation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Sale must include at least one item'),
  body('items.*.product_id')
    .notEmpty()
    .withMessage('Product ID is required'),
  body('items.*.quantity')
    .isNumeric()
    .withMessage('Quantity must be a number')
    .toInt()
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('items.*.unit_price')
    .isNumeric()
    .withMessage('Unit price must be a number')
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Unit price cannot be negative'),
  body('total_amount')
    .isNumeric()
    .withMessage('Total amount must be a number')
    .toFloat()
    .isFloat({ min: 0 })
    .withMessage('Total amount cannot be negative'),
  body('payment_method')
    .optional()
    .isIn(['cash', 'card', 'mobile', 'other'])
    .withMessage('Invalid payment method')
];

// Complete sale
export const completeSale = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const { items, total_amount, payment_method = 'cash', notes } = req.body;

  try {
    // Validate products and calculate totals
    let calculatedSubtotal = 0;
    const saleItems: any[] = [];

    for (const item of items) {
      // Find product
      const product = await prisma.product.findFirst({
        where: {
          id: item.product_id,
          isActive: true,
          storeId: user.storeId
        }
      });

      if (!product) {
        res.status(404).json({
          success: false,
          error: `Product not found: ${item.product_id}`
        });
        return;
      }

      // Check stock availability
      if (product.stockQuantity < item.quantity) {
        res.status(400).json({
          success: false,
          error: `Insufficient stock for product: ${product.name}`
        });
        return;
      }

      // Calculate item total
      const itemTotal = item.quantity * item.unit_price;
      calculatedSubtotal += itemTotal;

      saleItems.push({
        productId: product.id,
        productName: product.name,
        productBarcode: product.barcode,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: itemTotal
      });
    }

    // Validate total amount
    const tolerance = 0.01; // Allow for small floating point differences
    if (Math.abs(calculatedSubtotal - total_amount) > tolerance) {
      res.status(400).json({
        success: false,
        error: 'Total amount does not match calculated subtotal'
      });
      return;
    }

    // Generate sale number
    const saleNumber = `S${Date.now()}${Math.random().toString(36).substr(2, 4)}`;

    // Create sale record
    const sale = await prisma.sale.create({
      data: {
        saleNumber,
        cashierId: user._id,
        storeId: user.storeId,
        subtotal: calculatedSubtotal,
        totalAmount: total_amount,
        paymentMethod: payment_method,
        status: 'completed',
        notes
      }
    });

    // Create sale items
    await prisma.saleItem.createMany({
      data: saleItems.map(item => ({
        ...item,
        saleId: sale.id
      }))
    });

    // Update inventory for each item
    for (const item of saleItems) {
      // Update product stock
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });

      if (product) {
        const previousQuantity = product.stockQuantity;
        const newQuantity = product.stockQuantity - item.quantity;

        // Update product stock
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: newQuantity,
            isLowStock: newQuantity <= product.minimumStockLevel
          }
        });

        // Create inventory transaction
        await prisma.inventoryTransaction.create({
          data: {
            productId: product.id,
            productName: product.name,
            productBarcode: product.barcode,
            transactionType: 'sale',
            quantityChange: -item.quantity,
            previousQuantity,
            newQuantity,
            reference: saleNumber,
            storeId: user.storeId,
            createdBy: user._id
          }
        });
      }
    }

    res.status(201).json({
      success: true,
      type: 'sale_complete_success',
      sale_id: sale.id,
      sale_number: sale.saleNumber,
      message: 'Sale completed successfully'
    });
  } catch (error) {
    throw createError('Error completing sale', 500);
  }
});

// Get sales
export const getSales = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { status, limit = 50, offset = 0 } = req.query;

  const whereClause: any = { storeId: user.storeId };
  if (status) {
    whereClause.status = status;
  }

  const sales = await prisma.sale.findMany({
    where: whereClause,
    include: {
      cashier: {
        select: {
          username: true,
          firstName: true,
          lastName: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    take: parseInt(limit as string),
    skip: parseInt(offset as string)
  });

  const total = await prisma.sale.count({
    where: whereClause
  });

  res.status(200).json({
    success: true,
    count: sales.length,
    total,
    data: sales
  });
});

// Get sale by ID
export const getSale = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      storeId: user.storeId
    },
    include: {
      cashier: {
        select: {
          username: true,
          firstName: true,
          lastName: true
        }
      }
    }
  });

  if (!sale) {
    throw createError('Sale not found', 404);
  }

  res.status(200).json({
    success: true,
    data: sale
  });
});

// Get today's sales stats
export const getTodayStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const stats = await prisma.sale.aggregate({
    where: {
      storeId: user.storeId,
      status: 'completed',
      createdAt: {
        gte: today,
        lt: tomorrow
      }
    },
    _sum: {
      totalAmount: true
    },
    _count: {
      id: true
    },
    _avg: {
      totalAmount: true
    }
  });

  const result = {
    totalSales: stats._sum.totalAmount || 0,
    transactionCount: stats._count.id || 0,
    averageSale: stats._avg.totalAmount || 0
  };

  res.status(200).json({
    success: true,
    data: {
      today_sales: result.totalSales,
      today_transactions: result.transactionCount,
      average_sale: result.averageSale
    }
  });
});

// Cancel sale
export const cancelSale = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { reason } = req.body;

  const sale = await prisma.sale.findFirst({
    where: {
      id,
      storeId: user.storeId,
      status: { in: ['pending', 'completed'] }
    }
  });

  if (!sale) {
    throw createError('Sale not found or cannot be cancelled', 404);
  }

  // If sale is completed, we need to reverse the inventory changes
  if (sale.status === 'completed') {
    // Get sale items
    const saleItems = await prisma.saleItem.findMany({
      where: { saleId: id }
    });

    // Reverse inventory transactions
    for (const saleItem of saleItems) {
      // Add stock back to product
      const product = await prisma.product.findUnique({
        where: { id: saleItem.productId }
      });

      if (product) {
        const previousQuantity = product.stockQuantity;
        const newQuantity = product.stockQuantity + saleItem.quantity;

        // Update product stock
        await prisma.product.update({
          where: { id: product.id },
          data: {
            stockQuantity: newQuantity,
            isLowStock: newQuantity <= product.minimumStockLevel
          }
        });

        // Create reversal transaction
        await prisma.inventoryTransaction.create({
          data: {
            productId: product.id,
            productName: product.name,
            productBarcode: product.barcode,
            transactionType: 'return',
            quantityChange: saleItem.quantity,
            previousQuantity,
            newQuantity,
            reference: `Cancellation of sale ${sale.saleNumber}`,
            notes: reason,
            storeId: user.storeId,
            createdBy: user._id
          }
        });
      }
    }
  }

  // Update sale status
  await prisma.sale.update({
    where: { id },
    data: { status: 'cancelled' }
  });

  res.status(200).json({
    success: true,
    message: 'Sale cancelled successfully'
  });
});

// Get weekly sales stats
export const getWeeklyStats = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7); // End of week

  // Get sales for the week
  const salesInWeek = await prisma.sale.findMany({
    where: {
      storeId: user.storeId,
      status: 'completed',
      createdAt: {
        gte: weekStart,
        lt: weekEnd
      }
    },
    select: {
      totalAmount: true,
      createdAt: true
    }
  });

  // Group sales by date
  const salesByDate = salesInWeek.reduce((acc, sale) => {
    const date = sale.createdAt.toISOString().split('T')[0];
    if (!acc[date]) {
      acc[date] = { dailySales: 0, transactionCount: 0 };
    }
    acc[date].dailySales += sale.totalAmount;
    acc[date].transactionCount += 1;
    return acc;
  }, {} as Record<string, { dailySales: number; transactionCount: number }>);

  const stats = Object.entries(salesByDate).map(([date, data]) => ({
    _id: { year: parseInt(date.split('-')[0]), month: parseInt(date.split('-')[1]), day: parseInt(date.split('-')[2]) },
    dailySales: data.dailySales,
    transactionCount: data.transactionCount,
    averageSale: data.dailySales / data.transactionCount
  })).sort((a, b) => {
    if (a._id.year !== b._id.year) return a._id.year - b._id.year;
    if (a._id.month !== b._id.month) return a._id.month - b._id.month;
    return a._id.day - b._id.day;
  });

  // Calculate weekly totals
  const weeklyTotals = stats.reduce((acc, day) => ({
    totalSales: acc.totalSales + day.dailySales,
    totalTransactions: acc.totalTransactions + day.transactionCount,
    averageSale: acc.totalTransactions > 0 ? (acc.totalSales + day.dailySales) / (acc.totalTransactions + day.transactionCount) : 0
  }), { totalSales: 0, totalTransactions: 0, averageSale: 0 });

  res.status(200).json({
    success: true,
    data: {
      weekly_sales: weeklyTotals.totalSales,
      weekly_transactions: weeklyTotals.totalTransactions,
      weekly_average: weeklyTotals.averageSale,
      daily_breakdown: stats.map(day => ({
        date: `${day._id.year}-${day._id.month}-${day._id.day}`,
        sales: day.dailySales,
        transactions: day.transactionCount,
        average: day.averageSale
      }))
    }
  });
});

// Get weekly revenue report
export const getWeeklyRevenue = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7); // End of week

  const revenue = await prisma.sale.aggregate({
    where: {
      storeId: user.storeId,
      status: 'completed',
      createdAt: {
        gte: weekStart,
        lt: weekEnd
      }
    },
    _sum: {
      totalAmount: true,
      subtotal: true,
      taxAmount: true
    },
    _count: {
      id: true
    }
  });

  const result = {
    totalRevenue: revenue._sum.totalAmount || 0,
    totalSubtotal: revenue._sum.subtotal || 0,
    totalTax: revenue._sum.taxAmount || 0,
    totalTransactions: revenue._count.id || 0
  };

  res.status(200).json({
    success: true,
    data: {
      weekly_revenue: result.totalRevenue,
      weekly_subtotal: result.totalSubtotal,
      weekly_tax: result.totalTax,
      weekly_transactions: result.totalTransactions,
      net_revenue: result.totalRevenue - result.totalTax
    }
  });
});
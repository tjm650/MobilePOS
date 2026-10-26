import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

// Get dashboard data
export const getDashboardData = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  try {
    // Get today's date range
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get today's sales for the user's store
    const todaySales = await prisma.sale.aggregate({
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
      }
    });

    const todaySalesResult = {
      total: todaySales._sum.totalAmount || 0,
      count: todaySales._count.id || 0
    };

    // Get product statistics
    const totalProducts = await prisma.product.count({
      where: {
        isActive: true,
        storeId: user.storeId
      }
    });

    const lowStockProducts = await prisma.product.count({
      where: {
        isActive: true,
        storeId: user.storeId,
        isLowStock: true
      }
    });

    const outOfStockProducts = await prisma.product.count({
      where: {
        isActive: true,
        storeId: user.storeId,
        stockQuantity: 0
      }
    });

    // Get inventory value
    const inventoryValueResult = await prisma.product.aggregate({
      where: {
        isActive: true,
        storeId: user.storeId
      },
      _sum: {
        stockQuantity: true,
        price: true
      }
    });

    // Calculate total inventory value (stock * price for each product)
    const products = await prisma.product.findMany({
      where: {
        isActive: true,
        storeId: user.storeId
      },
      select: {
        stockQuantity: true,
        price: true
      }
    });

    const totalInventoryValue = products.reduce((total, product) => {
      return total + (product.stockQuantity * product.price);
    }, 0);

    // Get average profit margin (simplified calculation)
    const productsWithCost = await prisma.product.findMany({
      where: {
        isActive: true,
        storeId: user.storeId,
        costPrice: { gt: 0 }
      },
      select: {
        price: true,
        costPrice: true
      }
    });

    const averageProfitMargin = productsWithCost.length > 0
      ? productsWithCost.reduce((sum, product) => {
          const margin = ((product.price - product.costPrice) / product.price) * 100;
          return sum + margin;
        }, 0) / productsWithCost.length
      : 0;

    // Get active cashiers in the store
    const activeCashiers = await prisma.user.count({
      where: {
        storeId: user.storeId,
        isActive: true,
        isActivePos: true
      }
    });

    // Get recent sales (last 5)
    const recentSales = await prisma.sale.findMany({
      where: {
        storeId: user.storeId,
        status: 'completed'
      },
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
      take: 5
    });

    // Get low stock products (top 5)
    const lowStockItems = await prisma.product.findMany({
      where: {
        isActive: true,
        storeId: user.storeId,
        isLowStock: true
      },
      orderBy: {
        stockQuantity: 'asc'
      },
      take: 5,
      select: {
        barcode: true,
        name: true,
        stockQuantity: true,
        minimumStockLevel: true
      }
    });

    // Get recent inventory transactions (last 10)
    const recentTransactions = await prisma.inventoryTransaction.findMany({
      where: {
        storeId: user.storeId
      },
      include: {
        product: {
          select: {
            name: true,
            barcode: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 10
    });

    res.status(200).json({
      success: true,
      data: {
        today_sales: todaySalesResult.total,
        today_transactions: todaySalesResult.count,
        total_products: totalProducts,
        low_stock_products: lowStockProducts,
        out_of_stock_products: outOfStockProducts,
        total_inventory_value: totalInventoryValue,
        average_profit_margin: averageProfitMargin,
        active_cashiers: activeCashiers,
        recent_sales: recentSales,
        low_stock_items: lowStockItems,
        recent_transactions: recentTransactions
      }
    });
  } catch (error) {
    throw createError('Error fetching dashboard data', 500);
  }
});

// Get sales analytics
export const getSalesAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { period = '7d' } = req.query;

  try {
    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }

    // Get sales data for the period (simplified - group by date)
    const salesInPeriod = await prisma.sale.findMany({
      where: {
        storeId: user.storeId,
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      select: {
        totalAmount: true,
        createdAt: true
      }
    });

    // Group sales by date
    const salesByDate = salesInPeriod.reduce((acc, sale) => {
      const date = sale.createdAt.toISOString().split('T')[0];
      if (!acc[date]) {
        acc[date] = { totalSales: 0, transactionCount: 0 };
      }
      acc[date].totalSales += sale.totalAmount;
      acc[date].transactionCount += 1;
      return acc;
    }, {} as Record<string, { totalSales: number; transactionCount: number }>);

    const salesData = Object.entries(salesByDate).map(([date, data]) => ({
      _id: { year: parseInt(date.split('-')[0]), month: parseInt(date.split('-')[1]), day: parseInt(date.split('-')[2]) },
      dailySales: data.totalSales,
      transactionCount: data.transactionCount,
      averageSale: data.totalSales / data.transactionCount
    })).sort((a, b) => {
      if (a._id.year !== b._id.year) return a._id.year - b._id.year;
      if (a._id.month !== b._id.month) return a._id.month - b._id.month;
      return a._id.day - b._id.day;
    });

    // Get payment method breakdown
    const paymentBreakdownRaw = await prisma.sale.groupBy({
      by: ['paymentMethod'],
      where: {
        storeId: user.storeId,
        status: 'completed',
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      _sum: {
        totalAmount: true
      },
      _count: {
        id: true
      }
    });

    const paymentBreakdown = paymentBreakdownRaw.map(item => ({
      _id: item.paymentMethod,
      total: item._sum.totalAmount || 0,
      count: item._count.id || 0
    }));

    // Get top selling products using SaleItem aggregation
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: {
          storeId: user.storeId,
          status: 'completed',
          createdAt: {
            gte: startDate,
            lte: now
          }
        }
      },
      select: {
        productId: true,
        productName: true,
        quantity: true,
        totalPrice: true
      }
    });

    // Aggregate product sales
    const productSales = saleItems.reduce((acc, item) => {
      const productId = item.productId;
      if (!acc[productId]) {
        acc[productId] = {
          productName: item.productName,
          totalQuantity: 0,
          totalRevenue: 0
        };
      }
      acc[productId].totalQuantity += item.quantity;
      acc[productId].totalRevenue += item.totalPrice;
      return acc;
    }, {} as Record<string, { productName: string; totalQuantity: number; totalRevenue: number }>);

    const topProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        _id: productId,
        productName: data.productName,
        totalQuantity: data.totalQuantity,
        totalRevenue: data.totalRevenue
      }))
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        salesData,
        paymentBreakdown,
        topProducts
      }
    });
  } catch (error) {
    throw createError('Error fetching sales analytics', 500);
  }
});

// Get inventory analytics
export const getInventoryAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const { period = '30d' } = req.query;

  try {
    // Calculate date range
    const now = new Date();
    let startDate: Date;

    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get inventory movement summary
    const inventoryMovementRaw = await prisma.inventoryTransaction.groupBy({
      by: ['transactionType'],
      where: {
        storeId: user.storeId,
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      _sum: {
        quantityChange: true
      },
      _count: {
        id: true
      }
    });

    const inventoryMovement = inventoryMovementRaw.map(item => ({
      _id: item.transactionType,
      totalQuantity: item._sum.quantityChange || 0,
      transactionCount: item._count.id || 0
    })).sort((a, b) => Math.abs(b.totalQuantity) - Math.abs(a.totalQuantity));

    // Get products with most inventory movement
    const productMovementRaw = await prisma.inventoryTransaction.groupBy({
      by: ['productId'],
      where: {
        storeId: user.storeId,
        createdAt: {
          gte: startDate,
          lte: now
        }
      },
      _sum: {
        quantityChange: true
      },
      _count: {
        id: true
      }
    });

    // Get product details for the top moving products
    const productMovement = await Promise.all(
      productMovementRaw
        .map(async (item) => {
          const product = await prisma.product.findUnique({
            where: { id: item.productId },
            select: {
              name: true,
              barcode: true
            }
          });

          if (product) {
            return {
              _id: item.productId,
              productName: product.name,
              productBarcode: product.barcode,
              totalMovement: Math.abs(item._sum.quantityChange || 0),
              transactionCount: item._count.id || 0
            };
          }
          return null;
        })
        .filter(Boolean)
    );

    const validProductMovement = productMovement.filter((item): item is NonNullable<typeof item> => item !== null);
    validProductMovement.sort((a, b) => b.totalMovement - a.totalMovement).slice(0, 10);

    res.status(200).json({
      success: true,
      data: {
        period,
        startDate,
        endDate: now,
        inventoryMovement,
        productMovement
      }
    });
  } catch (error) {
    throw createError('Error fetching inventory analytics', 500);
  }
});
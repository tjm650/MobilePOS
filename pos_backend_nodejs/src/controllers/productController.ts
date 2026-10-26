import { Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { PrismaClient } from '@prisma/client';
import { asyncHandler, createError } from '../middleware/errorHandler';

const prisma = new PrismaClient();

export const scanProductValidation = [
  body('barcode')
    .notEmpty()
    .withMessage('Barcode is required')
    .isString()
    .withMessage('Barcode must be a string')
];

export const createProductValidation = [
  body('barcode')
    .notEmpty()
    .withMessage('Barcode is required')
    .isString()
    .withMessage('Barcode must be a string'),
  body('name')
    .notEmpty()
    .withMessage('Product name is required')
    .isString()
    .withMessage('Product name must be a string'),
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isString()
    .withMessage('Category must be a string'),
  body('price')
    .isNumeric()
    .withMessage('Price must be a number')
    .toFloat(),
  body('costPrice')
    .isNumeric()
    .withMessage('Cost price must be a number')
    .toFloat(),
  body('stockQuantity')
    .optional()
    .isNumeric()
    .withMessage('Stock quantity must be a number')
    .toInt(),
  body('minimumStockLevel')
    .optional()
    .isNumeric()
    .withMessage('Minimum stock level must be a number')
    .toInt()
];

export const updateProductValidation = [
  param('id')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('name')
    .optional()
    .isString()
    .withMessage('Product name must be a string'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('price')
    .optional()
    .isNumeric()
    .withMessage('Price must be a number')
    .toFloat(),
  body('costPrice')
    .optional()
    .isNumeric()
    .withMessage('Cost price must be a number')
    .toFloat(),
  body('stockQuantity')
    .optional()
    .isNumeric()
    .withMessage('Stock quantity must be a number')
    .toInt(),
  body('minimumStockLevel')
    .optional()
    .isNumeric()
    .withMessage('Minimum stock level must be a number')
    .toInt()
];

export const searchProductsValidation = [
  query('search')
    .optional()
    .isString()
    .withMessage('Search query must be a string'),
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  query('low_stock')
    .optional()
    .isIn(['true', 'false'])
    .withMessage('Low stock must be true or false')
];

// Scan product by barcode
export const scanProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { barcode } = req.body;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  try {
    const product = await prisma.product.findFirst({
      where: {
        barcode,
        isActive: true,
        storeId: user.storeId
      }
    });

    if (!product) {
      res.status(404).json({
        success: false,
        type: 'product_not_found',
        barcode
      });
      return;
    }

    res.status(200).json({
      success: true,
      type: 'product_found',
      product: {
        id: product.id,
        barcode: product.barcode,
        name: product.name,
        price: product.price.toString(),
        stockQuantity: product.stockQuantity,
        isLowStock: product.isLowStock
      }
    });
  } catch (error) {
    throw createError('Error scanning product', 500);
  }
});

// Get all products with optional filtering
export const getProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const { search, category, low_stock } = req.query;

  let whereClause: any = {
    isActive: true,
    storeId: user.storeId
  };

  // Add search filter (simplified - search in name and barcode)
  if (search) {
    whereClause.OR = [
      { name: { contains: search as string, mode: 'insensitive' } },
      { barcode: { contains: search as string, mode: 'insensitive' } }
    ];
  }

  // Add category filter
  if (category) {
    whereClause.category = category;
  }

  // Add low stock filter
  if (low_stock === 'true') {
    whereClause.isLowStock = true;
  }

  const products = await prisma.product.findMany({
    where: whereClause,
    orderBy: { name: 'asc' }
  });

  // Transform data to match frontend expectations
  const transformedProducts = products.map(product => ({
    item_id: product.id,
    sku: product.barcode,
    barcode: product.barcode,
    product_name: product.name,
    brand: 'Generic Brand', // Default brand since not in schema
    category: product.category,
    selling_price: product.price,
    cost_price: product.costPrice,
    retail_price: product.price, // Use same as selling price for now
    current_stock: product.stockQuantity,
    stock_status: product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    is_low_stock: product.isLowStock,
    profit_margin: product.profitMargin || 0,
    is_featured: false // Default featured status
  }));

  res.status(200).json(transformedProducts);
});

// Get single product by ID
export const getProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const product = await prisma.product.findFirst({
    where: {
      id,
      isActive: true,
      storeId: user.storeId
    }
  });

  if (!product) {
    throw createError('Product not found', 404);
  }

  // Transform to expected format
  const transformedProduct = {
    item_id: product.id,
    sku: product.barcode,
    barcode: product.barcode,
    product_name: product.name,
    brand: 'Generic Brand',
    category: product.category,
    selling_price: product.price,
    cost_price: product.costPrice,
    current_stock: product.stockQuantity,
    stock_status: product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    is_low_stock: product.isLowStock,
    profit_margin: product.profitMargin || 0,
    is_featured: false
  };

  res.status(200).json({
    success: true,
    data: transformedProduct
  });
});

// Create new product
export const createProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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
  const productData = {
    ...req.body,
    storeId: user.storeId,
    createdBy: user._id
  };

  const product = await prisma.product.create({
    data: productData
  });

  // Transform to expected format
  const transformedProduct = {
    item_id: product.id,
    sku: product.barcode,
    barcode: product.barcode,
    product_name: product.name,
    brand: 'Generic Brand',
    category: product.category,
    selling_price: product.price,
    cost_price: product.costPrice,
    current_stock: product.stockQuantity,
    stock_status: product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    is_low_stock: product.isLowStock,
    profit_margin: product.profitMargin || 0,
    is_featured: false
  };

  res.status(201).json({
    success: true,
    message: 'Product created successfully',
    data: transformedProduct
  });
});

// Update product
export const updateProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { id } = req.params;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };
  const updateData = req.body;

  const product = await prisma.product.update({
    where: {
      id,
      isActive: true,
      storeId: user.storeId
    },
    data: updateData
  });

  if (!product) {
    throw createError('Product not found', 404);
  }

  // Transform to expected format
  const transformedProduct = {
    item_id: product.id,
    sku: product.barcode,
    barcode: product.barcode,
    product_name: product.name,
    brand: 'Generic Brand',
    category: product.category,
    selling_price: product.price,
    cost_price: product.costPrice,
    current_stock: product.stockQuantity,
    stock_status: product.stockQuantity > 0 ? 'In Stock' : 'Out of Stock',
    is_low_stock: product.isLowStock,
    profit_margin: product.profitMargin || 0,
    is_featured: false
  };

  res.status(200).json({
    success: true,
    message: 'Product updated successfully',
    data: transformedProduct
  });
});

// Delete product (soft delete)
export const deleteProduct = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { id } = req.params;
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const product = await prisma.product.update({
    where: {
      id,
      isActive: true,
      storeId: user.storeId
    },
    data: { isActive: false }
  });

  if (!product) {
    throw createError('Product not found', 404);
  }

  res.status(200).json({
    success: true,
    message: 'Product deleted successfully'
  });
});

// Get low stock products
export const getLowStockProducts = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // Mock user for development (no authentication)
  const user = {
    _id: 'dev-user-id',
    storeId: 'store_001',
    username: 'dev_user',
    role: 'admin'
  };

  const products = await prisma.product.findMany({
    where: {
      isActive: true,
      storeId: user.storeId,
      isLowStock: true
    },
    select: {
      barcode: true,
      name: true,
      category: true,
      price: true,
      stockQuantity: true,
      minimumStockLevel: true
    }
  });

  res.status(200).json({
    success: true,
    count: products.length,
    data: products
  });
});
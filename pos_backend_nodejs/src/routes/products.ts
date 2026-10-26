import express from 'express';
import {
  scanProduct,
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts,
  scanProductValidation,
  createProductValidation,
  updateProductValidation,
  searchProductsValidation
} from '../controllers/productController';
const router = express.Router();

// No authentication required - use mock user

// Product scanning (replaces WebSocket functionality)
router.post('/scan', scanProductValidation, scanProduct);

// Get products with optional filtering
router.get('/', searchProductsValidation, getProducts);

// Get low stock products
router.get('/low-stock', getLowStockProducts);

// Get single product
router.get('/:id', getProduct);

// Create new product
router.post('/', createProductValidation, createProduct);

// Update product
router.put('/:id', updateProductValidation, updateProduct);

// Delete product (soft delete)
router.delete('/:id', deleteProduct);

export default router;
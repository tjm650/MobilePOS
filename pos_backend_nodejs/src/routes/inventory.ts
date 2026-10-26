import express from 'express';
import {
  updateInventory,
  getInventoryTransactions,
  getInventorySummary,
  adjustStock,
  updateInventoryValidation
} from '../controllers/inventoryController';
const router = express.Router();

// No authentication required - use mock user

// Update inventory (replaces WebSocket functionality)
router.post('/update', updateInventoryValidation, updateInventory);

// Adjust stock (convenience method)
router.post('/adjust-stock', adjustStock);

// Get inventory transactions
router.get('/transactions', getInventoryTransactions);

// Get inventory summary
router.get('/summary', getInventorySummary);

export default router;
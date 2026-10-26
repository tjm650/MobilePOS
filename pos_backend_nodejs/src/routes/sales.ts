import express from 'express';
import {
  completeSale,
  getSales,
  getSale,
  getTodayStats,
  getWeeklyStats,
  getWeeklyRevenue,
  cancelSale,
  completeSaleValidation
} from '../controllers/salesController';
const router = express.Router();

// No authentication required - use mock user

// Complete sale (replaces WebSocket functionality)
router.post('/complete', completeSaleValidation, completeSale);

// Get sales with optional filtering
router.get('/', getSales);

// Get today's sales stats
router.get('/today-stats', getTodayStats);

// Get weekly sales stats
router.get('/weekly-stats', getWeeklyStats);

// Get weekly revenue
router.get('/weekly-revenue', getWeeklyRevenue);

// Get single sale
router.get('/:id', getSale);

// Cancel sale
router.post('/:id/cancel', cancelSale);

export default router;
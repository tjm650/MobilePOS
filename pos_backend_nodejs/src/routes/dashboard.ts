import express from 'express';
import {
  getDashboardData,
  getSalesAnalytics,
  getInventoryAnalytics
} from '../controllers/dashboardController';
const router = express.Router();

// No authentication required - use mock user

// Get main dashboard data
router.get('/', getDashboardData);

// Get sales analytics
router.get('/analytics/sales', getSalesAnalytics);

// Get inventory analytics
router.get('/analytics/inventory', getInventoryAnalytics);

export default router;
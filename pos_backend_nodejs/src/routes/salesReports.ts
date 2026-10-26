import express from 'express';
import {
  getSalesReports,
  getDetailedSalesReport,
  getSalesByDateRange,
  getProductPerformanceReport,
  getRevenueReport,
  salesReportValidation
} from '../controllers/salesReportController';
import { devAuth, authenticate } from '../middleware/auth';

const router = express.Router();

// Development mode - no authentication required
router.use(devAuth);

// Get general sales reports
router.get('/', salesReportValidation, getSalesReports);

// Get detailed sales report
router.get('/detailed', salesReportValidation, getDetailedSalesReport);

// Get sales by date range
router.get('/by-date-range', salesReportValidation, getSalesByDateRange);

// Get product performance report
router.get('/product-performance', getProductPerformanceReport);

// Get revenue report
router.get('/revenue', getRevenueReport);

export default router;
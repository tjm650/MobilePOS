import express from 'express';
import {
  getTaxes,
  getTax,
  createTax,
  updateTax,
  deleteTax,
  createTaxValidation,
  updateTaxValidation
} from '../controllers/taxController';
import { devAuth, authenticate } from '../middleware/auth';

const router = express.Router();

// Development mode - no authentication required
router.use(devAuth);

// Get all taxes
router.get('/', getTaxes);

// Get single tax
router.get('/:id', getTax);

// Create new tax
router.post('/', createTaxValidation, createTax);

// Update tax
router.put('/:id', updateTaxValidation, updateTax);

// Delete tax (soft delete)
router.delete('/:id', deleteTax);

export default router;
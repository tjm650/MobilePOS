import { Request, Response } from 'express';
import { prisma } from '../index';

// Tax model (we'll add this to the schema later if needed)
interface Tax {
  id?: number;
  name: string;
  rate: number;
  description?: string;
  isActive: boolean;
  storeId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Get all taxes
export const getTaxes = async (req: Request, res: Response) => {
  try {
    // For now, return a static list of taxes
    // In a real implementation, this would come from the database
    const taxes = [
      {
        id: 1,
        name: 'VAT',
        rate: 0.15,
        description: 'Value Added Tax',
        isActive: true,
        storeId: 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    res.json(taxes);
  } catch (error) {
    console.error('Error fetching taxes:', error);
    res.status(500).json({ error: 'Failed to fetch taxes' });
  }
};

// Get single tax
export const getTax = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const taxId = parseInt(id);

    // For now, return static data
    if (taxId === 1) {
      const tax = {
        id: 1,
        name: 'VAT',
        rate: 0.15,
        description: 'Value Added Tax',
        isActive: true,
        storeId: 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      res.json(tax);
    } else {
      res.status(404).json({ error: 'Tax not found' });
    }
  } catch (error) {
    console.error('Error fetching tax:', error);
    res.status(500).json({ error: 'Failed to fetch tax' });
  }
};

// Create new tax
export const createTax = async (req: Request, res: Response) => {
  try {
    const { name, rate, description, isActive, storeId } = req.body;

    // Validate required fields
    if (!name || rate === undefined) {
      return res.status(400).json({ error: 'Name and rate are required' });
    }

    // For now, return the created tax with a mock ID
    const newTax = {
      id: Date.now(), // Mock ID
      name,
      rate,
      description,
      isActive: isActive !== undefined ? isActive : true,
      storeId: storeId || 'default',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    res.status(201).json(newTax);
  } catch (error) {
    console.error('Error creating tax:', error);
    res.status(500).json({ error: 'Failed to create tax' });
  }
};

// Update tax
export const updateTax = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const taxId = parseInt(id);
    const { name, rate, description, isActive } = req.body;

    // For now, return updated tax if it exists
    if (taxId === 1) {
      const updatedTax = {
        id: 1,
        name: name || 'VAT',
        rate: rate !== undefined ? rate : 0.15,
        description: description || 'Value Added Tax',
        isActive: isActive !== undefined ? isActive : true,
        storeId: 'default',
        createdAt: new Date(),
        updatedAt: new Date()
      };
      res.json(updatedTax);
    } else {
      res.status(404).json({ error: 'Tax not found' });
    }
  } catch (error) {
    console.error('Error updating tax:', error);
    res.status(500).json({ error: 'Failed to update tax' });
  }
};

// Delete tax (soft delete)
export const deleteTax = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const taxId = parseInt(id);

    // For now, just return success if tax exists
    if (taxId === 1) {
      res.json({ message: 'Tax deleted successfully' });
    } else {
      res.status(404).json({ error: 'Tax not found' });
    }
  } catch (error) {
    console.error('Error deleting tax:', error);
    res.status(500).json({ error: 'Failed to delete tax' });
  }
};

// Validation middleware
export const createTaxValidation = [
  (req: Request, res: Response, next: Function) => {
    const { name, rate } = req.body;

    if (!name || typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid name is required' });
    }

    if (rate === undefined || typeof rate !== 'number' || rate < 0 || rate > 1) {
      return res.status(400).json({ error: 'Valid rate (0-1) is required' });
    }

    next();
  }
];

export const updateTaxValidation = [
  (req: Request, res: Response, next: Function) => {
    const { name, rate } = req.body;

    if (name && typeof name !== 'string') {
      return res.status(400).json({ error: 'Valid name is required' });
    }

    if (rate !== undefined && (typeof rate !== 'number' || rate < 0 || rate > 1)) {
      return res.status(400).json({ error: 'Valid rate (0-1) is required' });
    }

    next();
  }
];
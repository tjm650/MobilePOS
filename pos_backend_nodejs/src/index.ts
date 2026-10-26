import express from 'express';
import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import http from 'http';

// Import routes
import authRoutes from './routes/auth';
import productRoutes from './routes/products';
import saleRoutes from './routes/sales';
import inventoryRoutes from './routes/inventory';
import dashboardRoutes from './routes/dashboard';
import taxRoutes from './routes/taxes';
import salesReportRoutes from './routes/salesReports';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

// Import services
import { WebSocketService } from './services/websocketService';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Create HTTP server
const server = http.createServer(app);

// Initialize Prisma Client
export const prisma = new PrismaClient();

// Initialize WebSocket service
export const wsService = new WebSocketService(server);

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: [
    'http://192.168.137.1:8000',
    'http://192.168.137.1:8081',
    'http://192.168.137.1:8082',
    'http://192.168.137.1:8083',
    'http://192.168.137.1:8084',
    'http://192.168.137.1:19000',
    'http://192.168.137.1:19006',
    'http://localhost:19006',
    'http://127.0.0.1:19006',
    'http://localhost:3000',
    'http://127.0.0.1:3000'
  ],
  credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Database connection (using Prisma with MongoDB Atlas)
const connectDB = async () => {
  try {
    // Prisma connects automatically when you use it
    await prisma.$connect();
    console.log('MongoDB Atlas database connected successfully');
  } catch (error) {
    console.error('Database connection error:', error);
    process.exit(1);
  }
};

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/taxes', taxRoutes);
app.use('/api/sales-reports', salesReportRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Mobile POS Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Start server
const startServer = async () => {
  await connectDB();

  server.listen(Number(PORT), '192.168.137.1', () => {
    console.log(`Server running on http://192.168.137.1:${PORT}`);
    console.log(`WebSocket available at ws://192.168.137.1:${PORT}/ws/pos/1`);
    console.log(`Health check available at http://192.168.137.1:${PORT}/health`);
  });
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Promise Rejection:', err.message);
  process.exit(1);
});

startServer();
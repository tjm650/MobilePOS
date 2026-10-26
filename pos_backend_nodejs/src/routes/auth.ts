import express from 'express';
import {
   register,
   login,
   refreshToken,
   logout,
   getProfile,
   updateProfile,
   changePassword,
   sendVerification,
   registerValidation,
   loginValidation
 } from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

// Public routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/refresh', refreshToken);
router.post('/logout', logout);
router.post('/send-verification', sendVerification);

// Protected routes
router.get('/profile', authenticate, getProfile);
router.put('/profile', authenticate, updateProfile);
router.post('/change-password', authenticate, changePassword);

export default router;
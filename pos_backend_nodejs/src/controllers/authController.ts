import { Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { DatabaseService } from '../services/databaseService';
import { JwtUtils } from '../utils/jwt';
import { asyncHandler, createError } from '../middleware/errorHandler';
import User, { IUser } from '../models/User';

export const registerValidation = [
  body('username')
    .isLength({ min: 3, max: 50 })
    .withMessage('Username must be between 3 and 50 characters')
    .matches(/^[a-zA-Z0-9_]+$/)
    .withMessage('Username can only contain letters, numbers, and underscores'),
  body('email')
    .isEmail()
    .withMessage('Please provide a valid email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long'),
  body('firstName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('First name is required'),
  body('lastName')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Last name is required'),
  body('storeId')
    .trim()
    .isLength({ min: 1, max: 50 })
    .withMessage('Store ID is required')
];

export const loginValidation = [
  body('username')
    .notEmpty()
    .withMessage('Username or email is required'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

export const register = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { username, email, password, firstName, lastName, storeId } = req.body;

  // Check if user already exists
  const existingUser = await DatabaseService.findUserByUsername(username) ||
                      await DatabaseService.findUserByEmail(email);

  if (existingUser) {
    res.status(400).json({
      success: false,
      error: 'User already exists with this email or username'
    });
    return;
  }

  // Create new user
  const user = await DatabaseService.createUser({
    username,
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
    storeId,
    role: 'cashier', // Default role
    isActive: true,
    emailVerified: false
  });

  if (!user) {
    throw createError('Error creating user', 500);
  }

  // Generate tokens
  const tokens = JwtUtils.generateTokens(user);

  res.status(201).json({
    success: true,
    message: 'Registration successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storeId: user.storeId,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      },
      tokens
    }
  });
});

export const login = asyncHandler(async (req: Request, res: Response): Promise<void> => {
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

  const { username, password } = req.body;

  // Find user by username or email
  const user = await DatabaseService.findUserByUsernameOrEmail(username);

  if (!user) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
    return;
  }

  // Check if user is active
  if (!user.isActive) {
    res.status(401).json({
      success: false,
      error: 'Account is deactivated'
    });
    return;
  }

  // Check password
  const isPasswordValid = await DatabaseService.comparePassword(user, password);
  if (!isPasswordValid) {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
    return;
  }

  // Generate tokens
  const tokens = JwtUtils.generateTokens(user);

  // Update user's last login
  await DatabaseService.updateUserLastLogin(user.id);

  res.status(200).json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storeId: user.storeId,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      },
      tokens
    }
  });
});

export const refreshToken = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    res.status(400).json({
      success: false,
      error: 'Refresh token is required'
    });
    return;
  }

  try {
    const decoded = JwtUtils.verifyToken(refreshToken);

    if (decoded.type !== 'refresh') {
      res.status(400).json({
        success: false,
        error: 'Invalid token type'
      });
      return;
    }

    const user = await DatabaseService.findUserById(decoded.id);
    if (!user || !user.isActive) {
      res.status(401).json({
        success: false,
        error: 'Invalid refresh token'
      });
      return;
    }

    const tokens = JwtUtils.generateTokens(user);

    res.status(200).json({
      success: true,
      data: {
        tokens
      }
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid refresh token'
    });
  }
});

export const logout = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  // In a stateless JWT setup, logout is typically handled on the client side
  // by removing the tokens. For server-side token blacklisting, you would
  // need to implement a token blacklist collection in MongoDB.

  res.status(200).json({
    success: true,
    message: 'Logout successful'
  });
});

export const getProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;

  res.status(200).json({
    success: true,
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storeId: user.storeId,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    }
  });
});

export const updateProfile = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user!;
  const { firstName, lastName, email } = req.body;

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await DatabaseService.findUserByEmail(email);
    if (existingUser && existingUser.id !== user.id) {
      res.status(400).json({
        success: false,
        error: 'Email is already taken'
      });
      return;
    }
  }

  // Update user
  const updatedUser = await DatabaseService.updateUser(user.id, {
    firstName: firstName || user.firstName,
    lastName: lastName || user.lastName,
    email: email ? email.toLowerCase() : user.email
  });

  if (!updatedUser) {
    throw createError('Error updating profile', 500);
  }

  res.status(200).json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        storeId: user.storeId,
        role: user.role,
        isActive: user.isActive,
        emailVerified: user.emailVerified
      }
    }
  });
});

export const changePassword = asyncHandler(async (req: Request, res: Response): Promise<void> => {
   const user = req.user!;
   const { currentPassword, newPassword } = req.body;

   if (!currentPassword || !newPassword) {
     res.status(400).json({
       success: false,
       error: 'Current password and new password are required'
     });
     return;
   }

   // Verify current password
   const isCurrentPasswordValid = await DatabaseService.comparePassword(user, currentPassword);
   if (!isCurrentPasswordValid) {
     res.status(400).json({
       success: false,
       error: 'Current password is incorrect'
     });
     return;
   }

   // Update password
   const updatedUser = await DatabaseService.updateUser(user.id, { password: newPassword });
   if (!updatedUser) {
     throw createError('Error updating password', 500);
   }

   res.status(200).json({
     success: true,
     message: 'Password changed successfully'
   });
 });

export const sendVerification = asyncHandler(async (req: Request, res: Response): Promise<void> => {
   const { email } = req.body;

   if (!email) {
     res.status(400).json({
       success: false,
       error: 'Email is required'
     });
     return;
   }

   // Find user by email
   const user = await DatabaseService.findUserByEmail(email);

   if (!user) {
     res.status(404).json({
       success: false,
       error: 'User not found with this email address'
     });
     return;
   }

   if (user.emailVerified) {
     res.status(400).json({
       success: false,
       error: 'Email is already verified'
     });
     return;
   }

   // Generate verification token
   const verificationToken = JwtUtils.generateEmailVerificationToken(user);

   // Update user with verification token
   const updatedUser = await DatabaseService.updateUser(user.id, {
     emailVerificationToken: verificationToken
   });

   if (!updatedUser) {
     throw createError('Error updating verification token', 500);
   }

   // TODO: Send email with verification link
   // For now, just return success
   res.status(200).json({
     success: true,
     message: 'Verification email sent successfully',
     data: {
       verificationToken, // In production, don't send this back
       email: user.email
     }
   });
 });
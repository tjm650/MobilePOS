import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export interface IUser {
  id: string;
  _id?: string; // For compatibility with Mongoose-style code
  username: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  storeId: string;
  role: 'admin' | 'cashier' | 'manager';
  isActive: boolean;
  isActivePos: boolean;
  emailVerified: boolean;
  emailVerificationToken?: string;
  passwordResetToken?: string;
  passwordResetExpires?: Date;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
  comparePassword?(candidatePassword: string): Promise<boolean>;

  // Mongoose-style methods for compatibility
  save?(): Promise<IUser>;
}

export class DatabaseService {
  // User methods
  static async findUserById(id: string): Promise<IUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { id }
      });
      return user ? this.addMongooseCompatibility(user) : null;
    } catch (error) {
      console.error('Database error finding user by ID:', error);
      return null;
    }
  }

  static async findUserByEmail(email: string): Promise<IUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { email: email.toLowerCase() }
      });
      return user ? this.addMongooseCompatibility(user) : null;
    } catch (error) {
      console.error('Database error finding user by email:', error);
      return null;
    }
  }

  static async findUserByUsername(username: string): Promise<IUser | null> {
    try {
      const user = await prisma.user.findUnique({
        where: { username }
      });
      return user ? this.addMongooseCompatibility(user) : null;
    } catch (error) {
      console.error('Database error finding user by username:', error);
      return null;
    }
  }

  static async findUserByUsernameOrEmail(identifier: string): Promise<IUser | null> {
    try {
      const user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: identifier },
            { email: identifier.toLowerCase() }
          ]
        }
      });
      return user ? this.addMongooseCompatibility(user) : null;
    } catch (error) {
      console.error('Database error finding user by username or email:', error);
      return null;
    }
  }

  static async findUsersByStoreId(storeId: string): Promise<IUser[]> {
    try {
      const users = await prisma.user.findMany({
        where: {
          storeId,
          isActive: true
        }
      });
      return users.map(user => this.addMongooseCompatibility(user));
    } catch (error) {
      console.error('Database error finding users by store ID:', error);
      return [];
    }
  }

  static async createUser(userData: Partial<IUser>): Promise<IUser | null> {
    try {
      const hashedPassword = await bcrypt.hash(userData.password!, 12);

      const user = await prisma.user.create({
        data: {
          username: userData.username!,
          email: userData.email!.toLowerCase(),
          password: hashedPassword,
          firstName: userData.firstName!,
          lastName: userData.lastName!,
          storeId: userData.storeId!,
          role: userData.role || 'cashier',
          isActive: userData.isActive ?? true,
          isActivePos: userData.isActivePos ?? false,
          emailVerified: userData.emailVerified ?? false,
          emailVerificationToken: userData.emailVerificationToken,
          passwordResetToken: userData.passwordResetToken,
          passwordResetExpires: userData.passwordResetExpires,
          lastLogin: userData.lastLogin
        }
      });

      return this.addMongooseCompatibility(user);
    } catch (error) {
      console.error('Database error creating user:', error);
      return null;
    }
  }

  static async updateUser(id: string, updateData: Partial<IUser>): Promise<IUser | null> {
    try {
      // Hash password if it's being updated
      if (updateData.password) {
        updateData.password = await bcrypt.hash(updateData.password, 12);
      }

      const user = await prisma.user.update({
        where: { id },
        data: updateData
      });

      return user as IUser;
    } catch (error) {
      console.error('Database error updating user:', error);
      return null;
    }
  }

  static async updateUserLastLogin(id: string): Promise<void> {
    try {
      await prisma.user.update({
        where: { id },
        data: { lastLogin: new Date() }
      });
    } catch (error) {
      console.error('Database error updating user last login:', error);
    }
  }

  // Helper function to add Mongoose-style compatibility to user objects
  static addMongooseCompatibility(user: any): IUser {
    return {
      ...user,
      _id: user.id, // Add _id property for Mongoose compatibility
      get id() { return this._id; }, // Ensure id getter works
      toString: function() { return this._id; }, // Add toString method for JWT utils
      save: async function() {
        const updated = await DatabaseService.updateUser(this.id, this);
        return updated || this;
      },
      comparePassword: async function(candidatePassword: string) {
        return DatabaseService.comparePassword(this, candidatePassword);
      }
    };
  }

  // Password comparison helper
  static async comparePassword(user: IUser, candidatePassword: string): Promise<boolean> {
    try {
      return await bcrypt.compare(candidatePassword, user.password);
    } catch (error) {
      console.error('Error comparing passwords:', error);
      return false;
    }
  }
}
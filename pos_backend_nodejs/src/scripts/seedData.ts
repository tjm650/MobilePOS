import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Clear existing data (skip if tables don't exist)
    console.log('🧹 Clearing existing data...');
    try {
      await prisma.inventoryTransaction.deleteMany();
      await prisma.saleItem.deleteMany();
      await prisma.sale.deleteMany();
      await prisma.product.deleteMany();
      await prisma.user.deleteMany();
      console.log('✅ Cleared existing data');
    } catch (error) {
      console.log('⚠️ Some tables may not exist yet, continuing...');
    }

    // Create sample users
    const hashedPassword = await bcrypt.hash('password123', 12);

    const users = [
      {
        username: 'admin',
        email: 'admin@mobilepos.com',
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        storeId: 'store_001',
        role: 'admin',
        isActive: true,
        isActivePos: true,
        emailVerified: true,
      },
      {
        username: 'cashier1',
        email: 'cashier1@mobilepos.com',
        password: hashedPassword,
        firstName: 'John',
        lastName: 'Doe',
        storeId: 'store_001',
        role: 'cashier',
        isActive: true,
        isActivePos: true,
        emailVerified: true,
      },
      {
        username: 'manager1',
        email: 'manager1@mobilepos.com',
        password: hashedPassword,
        firstName: 'Jane',
        lastName: 'Smith',
        storeId: 'store_001',
        role: 'manager',
        isActive: true,
        isActivePos: true,
        emailVerified: true,
      }
    ];

    console.log('👥 Creating users...');
    for (const userData of users) {
      await prisma.user.upsert({
        where: { email: userData.email },
        update: userData,
        create: userData,
      });
    }
    console.log(`✅ Created ${users.length} users`);

    // Get the created users for references
    const adminUser = await prisma.user.findUnique({ where: { email: 'admin@mobilepos.com' } });
    const cashierUser = await prisma.user.findUnique({ where: { email: 'cashier1@mobilepos.com' } });

    if (!adminUser || !cashierUser) {
      throw new Error('Failed to create users');
    }

    // Create sample products
    const products = [
      {
        barcode: '1234567890123',
        name: 'Premium Coffee Beans',
        description: 'High-quality Arabica coffee beans',
        category: 'Beverages',
        price: 25.99,
        costPrice: 15.00,
        stockQuantity: 50,
        minimumStockLevel: 10,
        isActive: true,
        isLowStock: false,
        storeId: 'store_001',
        createdBy: adminUser.id,
      },
      {
        barcode: '1234567890124',
        name: 'Organic Tea Bags',
        description: 'Assorted organic tea bags',
        category: 'Beverages',
        price: 12.99,
        costPrice: 7.50,
        stockQuantity: 30,
        minimumStockLevel: 5,
        isActive: true,
        isLowStock: false,
        storeId: 'store_001',
        createdBy: adminUser.id,
      },
      {
        barcode: '1234567890125',
        name: 'Chocolate Chip Cookies',
        description: 'Freshly baked chocolate chip cookies',
        category: 'Snacks',
        price: 8.99,
        costPrice: 4.20,
        stockQuantity: 75,
        minimumStockLevel: 15,
        isActive: true,
        isLowStock: false,
        storeId: 'store_001',
        createdBy: adminUser.id,
      },
      {
        barcode: '1234567890126',
        name: 'Mineral Water',
        description: 'Pure mineral water 500ml',
        category: 'Beverages',
        price: 2.50,
        costPrice: 0.80,
        stockQuantity: 100,
        minimumStockLevel: 20,
        isActive: true,
        isLowStock: false,
        storeId: 'store_001',
        createdBy: adminUser.id,
      },
      {
        barcode: '1234567890127',
        name: 'Sandwich Combo',
        description: 'Ham and cheese sandwich with chips',
        category: 'Food',
        price: 15.99,
        costPrice: 9.00,
        stockQuantity: 25,
        minimumStockLevel: 8,
        isActive: true,
        isLowStock: false,
        storeId: 'store_001',
        createdBy: adminUser.id,
      },
      {
        barcode: '1234567890128',
        name: 'Low Stock Item',
        description: 'This item is set to low stock for testing',
        category: 'Test',
        price: 5.99,
        costPrice: 3.00,
        stockQuantity: 3,
        minimumStockLevel: 10,
        isActive: true,
        isLowStock: true,
        storeId: 'store_001',
        createdBy: adminUser.id,
      }
    ];

    console.log('📦 Creating products...');
    for (const productData of products) {
      await prisma.product.upsert({
        where: { barcode: productData.barcode },
        update: productData,
        create: productData,
      });
    }
    console.log(`✅ Created ${products.length} products`);

    // Create sample sales
    const sales = [
      {
        saleNumber: 'S20241003001',
        cashierId: cashierUser.id,
        storeId: 'store_001',
        subtotal: 41.48,
        taxAmount: 6.22,
        discountAmount: 0,
        totalAmount: 47.70,
        paymentMethod: 'cash',
        status: 'completed',
        completedAt: new Date(),
      },
      {
        saleNumber: 'S20241003002',
        cashierId: cashierUser.id,
        storeId: 'store_001',
        subtotal: 28.98,
        taxAmount: 4.35,
        discountAmount: 2.00,
        totalAmount: 31.33,
        paymentMethod: 'card',
        status: 'completed',
        completedAt: new Date(),
      },
      {
        saleNumber: 'S20241003003',
        cashierId: adminUser.id,
        storeId: 'store_001',
        subtotal: 15.99,
        taxAmount: 2.40,
        discountAmount: 0,
        totalAmount: 18.39,
        paymentMethod: 'mobile',
        status: 'completed',
        completedAt: new Date(),
      }
    ];

    console.log('🛒 Creating sales...');
    for (const saleData of sales) {
      const sale = await prisma.sale.upsert({
        where: { saleNumber: saleData.saleNumber },
        update: saleData,
        create: saleData,
      });

      // Create sale items for each sale
      if (saleData.saleNumber === 'S20241003001') {
        const coffeeProduct = await prisma.product.findUnique({
          where: { barcode: '1234567890123' }
        });
        const cookiesProduct = await prisma.product.findUnique({
          where: { barcode: '1234567890125' }
        });

        if (coffeeProduct && cookiesProduct) {
          await prisma.saleItem.createMany({
            data: [
              {
                productId: coffeeProduct.id,
                productName: 'Premium Coffee Beans',
                productBarcode: '1234567890123',
                quantity: 1,
                unitPrice: 25.99,
                totalPrice: 25.99,
                saleId: sale.id,
              },
              {
                productId: cookiesProduct.id,
                productName: 'Chocolate Chip Cookies',
                productBarcode: '1234567890125',
                quantity: 2,
                unitPrice: 8.99,
                totalPrice: 17.98,
                saleId: sale.id,
              }
            ]
          });
        }
      } else if (saleData.saleNumber === 'S20241003002') {
        const teaProduct = await prisma.product.findUnique({
          where: { barcode: '1234567890124' }
        });
        const waterProduct = await prisma.product.findUnique({
          where: { barcode: '1234567890126' }
        });

        if (teaProduct && waterProduct) {
          await prisma.saleItem.createMany({
            data: [
              {
                productId: teaProduct.id,
                productName: 'Organic Tea Bags',
                productBarcode: '1234567890124',
                quantity: 2,
                unitPrice: 12.99,
                totalPrice: 25.98,
                saleId: sale.id,
              },
              {
                productId: waterProduct.id,
                productName: 'Mineral Water',
                productBarcode: '1234567890126',
                quantity: 1,
                unitPrice: 2.50,
                totalPrice: 2.50,
                saleId: sale.id,
              }
            ]
          });
        }
      } else if (saleData.saleNumber === 'S20241003003') {
        const sandwichProduct = await prisma.product.findUnique({
          where: { barcode: '1234567890127' }
        });

        if (sandwichProduct) {
          await prisma.saleItem.createMany({
            data: [
              {
                productId: sandwichProduct.id,
                productName: 'Sandwich Combo',
                productBarcode: '1234567890127',
                quantity: 1,
                unitPrice: 15.99,
                totalPrice: 15.99,
                saleId: sale.id,
              }
            ]
          });
        }
      }
    }
    console.log(`✅ Created ${sales.length} sales with items`);

    // Create inventory transactions
    console.log('📋 Creating inventory transactions...');
    const inventoryTransactions = [
      {
        productName: 'Premium Coffee Beans',
        productBarcode: '1234567890123',
        transactionType: 'sale',
        quantityChange: -1,
        previousQuantity: 50,
        newQuantity: 49,
        reference: 'S20241003001',
        storeId: 'store_001',
        createdBy: cashierUser.id,
      },
      {
        productName: 'Chocolate Chip Cookies',
        productBarcode: '1234567890125',
        transactionType: 'sale',
        quantityChange: -2,
        previousQuantity: 75,
        newQuantity: 73,
        reference: 'S20241003001',
        storeId: 'store_001',
        createdBy: cashierUser.id,
      },
      {
        productName: 'Organic Tea Bags',
        productBarcode: '1234567890124',
        transactionType: 'sale',
        quantityChange: -2,
        previousQuantity: 30,
        newQuantity: 28,
        reference: 'S20241003002',
        storeId: 'store_001',
        createdBy: cashierUser.id,
      },
      {
        productName: 'Mineral Water',
        productBarcode: '1234567890126',
        transactionType: 'sale',
        quantityChange: -1,
        previousQuantity: 100,
        newQuantity: 99,
        reference: 'S20241003002',
        storeId: 'store_001',
        createdBy: cashierUser.id,
      },
      {
        productName: 'Sandwich Combo',
        productBarcode: '1234567890127',
        transactionType: 'sale',
        quantityChange: -1,
        previousQuantity: 25,
        newQuantity: 24,
        reference: 'S20241003003',
        storeId: 'store_001',
        createdBy: adminUser.id,
      }
    ];

    for (const transactionData of inventoryTransactions) {
      // Find the product to get its ID
      const product = await prisma.product.findUnique({
        where: { barcode: transactionData.productBarcode }
      });

      if (product) {
        await prisma.inventoryTransaction.create({
          data: {
            ...transactionData,
            productId: product.id,
          }
        });
      }
    }
    console.log(`✅ Created ${inventoryTransactions.length} inventory transactions`);

    console.log('🎉 Database seeding completed successfully!');
    console.log('\n📊 Summary:');
    console.log(`   Users: ${users.length}`);
    console.log(`   Products: ${products.length}`);
    console.log(`   Sales: ${sales.length}`);
    console.log(`   Inventory Transactions: ${inventoryTransactions.length}`);

    console.log('\n🔐 Login Credentials:');
    console.log('   Admin: admin@mobilepos.com / password123');
    console.log('   Cashier: cashier1@mobilepos.com / password123');
    console.log('   Manager: manager1@mobilepos.com / password123');

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seeding function
seedDatabase()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  });
// Simple test to verify app structure
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testDatabaseConnection() {
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful');
    
    // Test creating a sample record
    const testSetting = await prisma.appSetting.upsert({
      where: { shopDomain: 'test-shop.myshopify.com' },
      create: {
        shopDomain: 'test-shop.myshopify.com',
        requireAcknowledgment: true,
        requirePhotoProof: false,
        blockFulfillment: true,
      },
      update: {},
    });
    
    console.log('✅ Database operations working');
    console.log('Test setting created:', testSetting);
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Database connection failed:', error);
  }
}

testDatabaseConnection();
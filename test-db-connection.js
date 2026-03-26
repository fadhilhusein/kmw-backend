const { PrismaClient } = require("@prisma/client");
require('dotenv').config();

async function testConnection() {
    const prisma = new PrismaClient();

    try {
        console.log('🔄 Testing database connection...');

        // Try to run a simple query
        const result = await prisma.$queryRaw`SELECT 1`;
        console.log('✅ Database connection successful!');
        console.log('Result:', result);

    } catch (error) {
        console.error('❌ Database connection failed!');
        console.error('Error details:', error.message);

        if (error.code === 'P1000') {
            console.error('⚠️  Error: Cannot reach database server');
            console.error('   Possible causes:');
            console.error('   - Network connectivity issues');
            console.error('   - Database server is down');
            console.error('   - Firewall blocking connection');
        } else if (error.code === 'P1001') {
            console.error('⚠️  Error: Authentication failed');
            console.error('   Possible causes:');
            console.error('   - Wrong username or password');
            console.error('   - Database user does not have access');
        } else if (error.code === 'P1003') {
            console.error('⚠️  Error: Database does not exist');
            console.error('   Possible causes:');
            console.error('   - Database name is incorrect');
            console.error('   - Database was deleted');
        } else if (error.message.includes('Tenant or user not found')) {
            console.error('⚠️  Error: Tenant or user not found');
            console.error('   Possible causes:');
            console.error('   - Supabase project is suspended/deleted');
            console.error('   - Database credentials are incorrect');
            console.error('   - Connection string format is wrong');
        }

    } finally {
        await prisma.$disconnect();
        console.log('🏁 Connection test completed');
    }
}

testConnection();

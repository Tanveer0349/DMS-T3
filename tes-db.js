const postgres = require('postgres');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testing connection to:', process.env.DATABASE_URL?.replace(/:[^@]+@/, ':****@'));
  
  const sql = postgres(process.env.DATABASE_URL);
  
  try {
    console.log('🔌 Attempting to connect...');
    const result = await sql`SELECT version()`;
    console.log('✅ Database connected successfully!');
    console.log('📊 PostgreSQL version:', result[0].version.substring(0, 50) + '...');
    
    // Test if we can run basic queries
    const testResult = await sql`SELECT NOW() as current_time`;
    console.log('⏰ Current database time:', testResult[0].current_time);
    
    console.log('🎉 Database is ready for migrations!');
    
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error('📝 Error message:', error.message);
    console.error('🔍 Error code:', error.code);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 DNS Resolution failed. Try these fixes:');
      console.log('1. ✅ Update your DATABASE_URL to use the pooler:');
      console.log('   postgresql://postgres.apbkobhfnmcqqzqeeqss:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres');
      console.log('2. ✅ Check your internet connection');
      console.log('3. ✅ Verify your Supabase project is active (not paused)');
      console.log('4. ✅ Try flushing DNS cache: ipconfig /flushdns');
    }
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Connection refused. Check:');
      console.log('1. ✅ Database password is correct');
      console.log('2. ✅ Project is not paused');
      console.log('3. ✅ Use port 6543 for pooler or 5432 for direct');
    }
  } finally {
    await sql.end();
  }
}

testConnection();
/**
 * Test MongoDB connection
 * Run with: npx tsx scripts/test-db.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })
import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI as string

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!')
  console.error('   Create a .env.local file with: MONGODB_URI=your-mongodb-uri')
  process.exit(1)
}

async function testConnection() {
  console.log('🔌 Testing MongoDB connection...')
  console.log(`   URI: ${MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`) // Hide credentials
  
  try {
    const startTime = Date.now()
    
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000, // 5 second timeout
    })
    
    const connectionTime = Date.now() - startTime
    
    console.log(`✅ Connected successfully in ${connectionTime}ms`)
    console.log('')
    console.log('📊 Connection Info:')
    console.log(`   Host: ${mongoose.connection.host}`)
    console.log(`   Port: ${mongoose.connection.port}`)
    console.log(`   Database: ${mongoose.connection.name}`)
    console.log(`   State: ${mongoose.connection.readyState === 1 ? 'Connected' : 'Not Connected'}`)
    
    // Test a simple operation
    console.log('')
    console.log('🧪 Testing database operations...')
    
    const collections = await mongoose.connection.db?.listCollections().toArray()
    console.log(`   Collections found: ${collections?.length || 0}`)
    
    if (collections && collections.length > 0) {
      console.log('   Collection names:')
      collections.forEach(col => {
        console.log(`     - ${col.name}`)
      })
    }
    
    // Get database stats
    const stats = await mongoose.connection.db?.stats()
    if (stats) {
      console.log('')
      console.log('📈 Database Stats:')
      console.log(`   Documents: ${stats.objects || 0}`)
      console.log(`   Storage Size: ${formatBytes(stats.storageSize || 0)}`)
      console.log(`   Data Size: ${formatBytes(stats.dataSize || 0)}`)
    }
    
    console.log('')
    console.log('✨ All tests passed! MongoDB is ready.')
    
  } catch (error: any) {
    console.error('')
    console.error('❌ Connection failed!')
    console.error('')
    
    if (error.name === 'MongoServerSelectionError') {
      console.error('🔍 Possible causes:')
      console.error('   1. MongoDB is not running')
      console.error('   2. Wrong connection string')
      console.error('   3. Network/firewall issues')
      console.error('')
      console.error('💡 Solutions:')
      console.error('   - Start MongoDB: mongod')
      console.error('   - Or use MongoDB Atlas (cloud)')
      console.error('   - Check your MONGODB_URI in .env.local')
    } else if (error.name === 'MongoParseError') {
      console.error('🔍 Invalid connection string format')
      console.error('   Check your MONGODB_URI syntax')
    } else {
      console.error(`Error: ${error.message}`)
    }
    
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('')
    console.log('🔌 Disconnected from MongoDB')
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

testConnection()


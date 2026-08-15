import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable is not set!')
  console.error('   Create a .env.local file with: MONGODB_URI=your-mongodb-uri')
}

// Flag to track if models have been registered
let modelsRegistered = false

// Register all models to ensure they're available for populate()
// This is necessary in serverless environments where models might not be imported
async function registerModels() {
  if (modelsRegistered) return
  
  try {
    // Dynamic imports to register all models
    await import('@/models/User')
    await import('@/models/Student')
    await import('@/models/SessionTemplate')
    await import('@/models/SessionOccurrence')
    await import('@/models/StudentSession')
    await import('@/models/Attendance')
    await import('@/models/ActivityLog')
    await import('@/models/Grade')
    await import('@/models/TeacherFeedback')
    await import('@/models/AttendanceClaim')
    await import('@/models/LearningDocument')
    await import('@/models/MonthlyPayment')
    await import('@/models/Room')
    await import('@/models/Conversation')
    await import('@/models/Settings')
    await import('@/models/Tenant')
    await import('@/models/Branch')
    await import('@/models/Invoice')
    await import('@/models/AiUsageLog')
    await import('@/models/Lead')
    await import('@/models/ScannerDevice')
    await import('@/models/HifzLog')
    await import('@/models/BehaviorLog')
    await import('@/models/AdmissionApplication')
    await import('@/models/Family')

    modelsRegistered = true
    console.log('✅ All Mongoose models registered')
  } catch (error) {
    console.error('❌ Error registering models:', error)
  }
}

interface GlobalMongoose {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
  lastConnectAttempt: number
}

declare global {
  // eslint-disable-next-line no-var
  var mongoose: GlobalMongoose | undefined
}

const cached: GlobalMongoose = global.mongoose || { 
  conn: null, 
  promise: null,
  lastConnectAttempt: 0
}

if (!global.mongoose) {
  global.mongoose = cached
}

// Connection retry settings
const MIN_RETRY_INTERVAL = 1000 // 1 second minimum between connection attempts

async function dbConnect(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local')
  }

  // Check if already connected
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn
  }

  // If connection is connecting, wait for it
  if (mongoose.connection.readyState === 2 && cached.promise) {
    try {
      cached.conn = await cached.promise
      return cached.conn
    } catch (e) {
      cached.promise = null
      cached.conn = null
    }
  }

  // Prevent rapid reconnection attempts
  const now = Date.now()
  if (cached.promise && (now - cached.lastConnectAttempt) < MIN_RETRY_INTERVAL) {
    try {
      cached.conn = await cached.promise
      return cached.conn
    } catch (e) {
      // Continue to create new connection
    }
  }

  // Reset if connection was lost
  if (mongoose.connection.readyState === 0) {
    cached.conn = null
    cached.promise = null
  }

  if (!cached.promise) {
    cached.lastConnectAttempt = now
    
    const opts = {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 10000, // 10 seconds
      socketTimeoutMS: 45000, // 45 seconds
      connectTimeoutMS: 10000, // 10 seconds
    }

    // Free-tier / serverless clusters occasionally time out on the first
    // (cold) connection. One quick retry absorbs almost all of these transient
    // blips so an attendance check-in doesn't fail with a 500.
    const connectWithRetry = async (attempt = 1): Promise<typeof mongoose> => {
      try {
        return await mongoose.connect(MONGODB_URI as string, opts)
      } catch (err) {
        if (attempt < 2) {
          console.warn(`⚠️ MongoDB connect attempt ${attempt} failed, retrying...`)
          await new Promise((r) => setTimeout(r, 1500))
          return connectWithRetry(attempt + 1)
        }
        throw err
      }
    }

    cached.promise = connectWithRetry().then((mongoose) => {
      console.log('✅ MongoDB connected successfully')
      return mongoose
    })
  }

  try {
    cached.conn = await cached.promise
    
    // Register all models after successful connection
    await registerModels()
  } catch (e) {
    cached.promise = null
    cached.conn = null
    console.error('❌ MongoDB connection error:', e)
    throw e
  }

  return cached.conn
}

export default dbConnect


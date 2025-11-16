import * as http from 'http';
import * as path from 'path';
import dotenv from 'dotenv';
import app from './app';
import { connectDB } from './db';
import { SocketService } from './sockets/socket.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../server/.env') });

// Create HTTP server
const server = http.createServer(app);

// Add immediate basic route for port detection
app.get('/', (req: any, res: any) => {
  res.json({ 
    message: 'MTC E-commerce Server is running!', 
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Port configuration for Render deployment
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

console.log('🔍 Debug - PORT from env:', process.env.PORT);
console.log('🔍 Debug - Final PORT value:', PORT);
console.log('🔍 Debug - HOST value:', HOST);
console.log("🗂 Current Working Directory:", process.cwd());


// Start server - BIND PORT FIRST for Render detection
async function startServer() {
  try {
    console.log('🚀 Starting server initialization...');
    
    // CRITICAL: Start listening FIRST so Render can detect the port
    server.listen(PORT, HOST, async () => {
      console.log(`✅ Server is running on ${HOST}:${PORT}`);
      console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔗 Client URL: ${process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173'}`);
      console.log(`📡 Server URL: http://${HOST}:${PORT}`);
      
      // Now connect to external services after port is bound
      try {
        console.log('🔌 Connecting to MongoDB...');
        await connectDB();
        console.log('✅ MongoDB connected successfully');
        
        console.log('🔌 Initializing Socket.IO...');
        SocketService.initialize(server);
        console.log('✅ Socket.IO initialized successfully');
        
        console.log('🎉 Server fully initialized and ready!');
      } catch (serviceError) {
        console.error('⚠️ External service connection failed, but server is still running:', serviceError);
        // Don't exit - keep server running even if external services fail
      }
    });
    
    // Handle server listen errors
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        console.error(`❌ Port ${PORT} is already in use`);
      } else {
        console.error('❌ Server error:', error);
      }
      process.exit(1);
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start the server
startServer();

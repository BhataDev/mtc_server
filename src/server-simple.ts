import * as http from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create Express app with minimal configuration
const app = express();

// Basic middleware
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/api/v1/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'MTC E-commerce Server is running!',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'MTC E-commerce Server is running!',
    status: 'OK',
    timestamp: new Date().toISOString()
  });
});

// Create HTTP server
const server = http.createServer(app);

// Port configuration
const PORT = parseInt(process.env.PORT || '4000', 10);
const HOST = process.env.HOST || '0.0.0.0';

console.log('🔍 Debug - PORT from env:', process.env.PORT);
console.log('🔍 Debug - Final PORT value:', PORT);
console.log('🔍 Debug - HOST value:', HOST);

// Start server immediately
server.listen(PORT, HOST, () => {
  console.log(`✅ Simple server is running on ${HOST}:${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📡 Health check: http://${HOST}:${PORT}/api/v1/health`);
});

// Handle server errors
server.on('error', (error: any) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use`);
  } else {
    console.error('❌ Server error:', error);
  }
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;

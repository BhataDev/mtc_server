import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import mongoose from 'mongoose';

export class SocketService {
  private static io: SocketIOServer;
  private static connectedUsers: Map<string, Socket> = new Map();

  static initialize(server: HttpServer) {
    try {
      console.log('🔌 Initializing Socket.IO server...');
      
      this.io = new SocketIOServer(server, {
        cors: {
          origin: process.env.CLIENT_URL || 'http://localhost:5173',
          methods: ['GET', 'POST'],
          credentials: true
        }
      });

      this.setupMiddleware();
      this.setupEventHandlers();
      this.setupMongoChangeStreams();

      console.log('✅ Socket.IO server initialized successfully');
      return this.io;
    } catch (error) {
      console.error('❌ Socket.IO initialization failed:', error);
      console.error('⚠️ Server will continue without Socket.IO functionality');
      // Don't throw - let server continue
      return null;
    }
  }

  private static setupMiddleware() {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        const decoded = verifyToken(token);
        socket.data.user = {
          id: decoded.id,
          username: decoded.username,
          role: decoded.role,
          branchId: decoded.branchId
        };

        next();
      } catch (err) {
        next(new Error('Invalid token'));
      }
    });
  }

  private static setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`User ${socket.data.user.username} connected`);
      
      // Store the connection
      this.connectedUsers.set(socket.data.user.id, socket);

      // Join appropriate rooms
      socket.join(`user:${socket.data.user.id}`);
      socket.join(`role:${socket.data.user.role}`);
      
      if (socket.data.user.branchId) {
        socket.join(`branch:${socket.data.user.branchId}`);
      }

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`User ${socket.data.user.username} disconnected`);
        this.connectedUsers.delete(socket.data.user.id);
      });

      // Subscribe to specific entities for real-time updates
      socket.on('subscribe', (entities: string[]) => {
        entities.forEach((entity) => {
          socket.join(`entity:${entity}`);
        });
      });

      socket.on('unsubscribe', (entities: string[]) => {
        entities.forEach((entity) => {
          socket.leave(`entity:${entity}`);
        });
      });
    });
  }

  private static setupMongoChangeStreams() {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn('MongoDB not connected. Skipping change streams setup.');
      return;
    }

    // Setup change streams for real-time updates
    const collections = [
      { name: 'products', model: 'products' },
      { name: 'categories', model: 'categories' },
      { name: 'subcategories', model: 'subcategories' },
      { name: 'offers', model: 'offercampaigns' },
      { name: 'branches', model: 'branches' },
      { name: 'newarrivals', model: 'newarrivals' },
      { name: 'branchbanners', model: 'branchbanners' },
      { name: 'globalbanners', model: 'globalbanners' },
      { name: 'auditlogs', model: 'auditlogs' }
    ];

    collections.forEach(({ name, model }) => {
      try {
        const collection = mongoose.connection.collection(model);
        const changeStream = collection.watch([], { fullDocument: 'updateLookup' });

        changeStream.on('change', (change) => {
          this.handleDatabaseChange(name, change);
        });

        changeStream.on('error', (error) => {
          console.error(`Change stream error for ${name}:`, error);
        });
      } catch (error) {
        console.error(`Failed to setup change stream for ${name}:`, error);
      }
    });
  }

  private static handleDatabaseChange(collection: string, change: any) {
    const document = change.fullDocument || change.documentKey;
    
    // Determine event type from operation type
    let eventType = 'updated';
    if (change.operationType === 'insert') {
      eventType = 'created';
    } else if (change.operationType === 'delete') {
      eventType = 'deleted';
    }

    // Broadcast changes based on collection and operation
    switch (collection) {
      case 'settings':
        this.broadcastToAll(`settings.${eventType}`, document);
        break;

      case 'branches':
        this.broadcastToAdmins(`branch.${eventType}`, document);
        if (document?._id) {
          this.broadcastToBranch(document._id.toString(), `branch.${eventType}`, document);
        }
        break;

      case 'categories':
      case 'subcategories':
        this.broadcastToAll(`${collection}.${eventType}`, document);
        break;

      case 'products':
        this.broadcastToAll(`product.${eventType}`, document);
        break;

      case 'offercampaigns':
        // Check if it's branch-specific or global
        if (document?.branch) {
          this.broadcastToBranch(document.branch.toString(), `offer.${eventType}`, document);
        } else {
          this.broadcastToAll(`offer.${eventType}`, document);
        }
        break;

      case 'newarrivals':
        // Check if it's branch-specific or global
        if (document?.branch) {
          this.broadcastToBranch(document.branch.toString(), `newArrival.${eventType}`, document);
        } else {
          this.broadcastToAll(`newArrival.${eventType}`, document);
        }
        break;

      case 'branchbanners':
        if (document?.branch) {
          this.broadcastToBranch(document.branch.toString(), `banner.${eventType}`, document);
        }
        this.broadcastToAdmins(`banner.${eventType}`, document);
        break;

      case 'globalbanners':
        this.broadcastToAll(`globalBanner.${eventType}`, document);
        break;

      case 'auditlogs':
        this.broadcastToAdmins(`audit.created`, document);
        break;
    }
  }

  // Broadcasting methods
  static emit(event: string, data: any, to?: string | string[]) {
    if (!this.io) return;

    if (to) {
      const rooms = Array.isArray(to) ? to : [to];
      rooms.forEach(room => {
        this.io.to(room).emit(event, data);
      });
    } else {
      this.io.emit(event, data);
    }
  }

  static broadcastToAll(event: string, data: any) {
    this.emit(event, data);
  }

  static broadcastToAdmins(event: string, data: any) {
    this.emit(event, data, 'role:admin');
  }

  static broadcastToBranch(branchId: string, event: string, data: any) {
    this.emit(event, data, [`branch:${branchId}`, 'role:admin']);
  }

  static broadcastToUser(userId: string, event: string, data: any) {
    this.emit(event, data, `user:${userId}`);
  }

  static getIO(): SocketIOServer {
    return this.io;
  }
}

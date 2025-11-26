import express, { Express, Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import * as path from 'path';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import * as crypto from 'crypto';

// Load environment variables
dotenv.config();

// Memory optimization for production
if (process.env.NODE_ENV === 'production') {
  // Disable source maps in production to save memory
  process.env.NODE_OPTIONS = '--max-old-space-size=512';
}

// Import routes
import authRoutes from './routes/auth.routes';
import customerAuthRoutes from './routes/customerAuth.routes';
import settingsRoutes from './routes/settings.routes';
import branchesRoutes from './routes/branches.routes';
import categoriesRoutes from './routes/categories.routes';
import subcategoriesRoutes from './routes/subcategories.routes';
import brandsRoutes from './routes/brands.routes';
import productsRoutes from './routes/products.routes';
import bannersRoutes from './routes/banners.routes';
import bannerCrudRoutes from './routes/banner.crud.routes';
import offersRoutes from './routes/offers.routes';
import newArrivalsRoutes from './routes/newArrivals.routes';
import auditRoutes from './routes/audit.routes';
import uploadRoutes from './routes/upload.routes';
import wishlistRoutes from './routes/wishlist.routes';
import cartRoutes from './routes/cart.routes';
import customersRoutes from './routes/customers.routes';
import orderRoutes from './routes/order.routes';
import addressRoutes from './routes/address.routes';

// Import middleware
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS, AUTH_RATE_LIMIT_MAX_REQUESTS } from './config/constants';

// Create Express app
const app: Express = express();

// Request ID middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
  res.setHeader('X-Request-Id', req.requestId!);
  next();
});

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow images from different origins
  crossOriginOpenerPolicy: { policy: "unsafe-none" } // Allow OAuth popups and postMessage
}));

// CORS configuration with allowlist for admin and user clients
const adminOrigin = process.env.CLIENT_URL || process.env.FRONTEND_URL || 'http://localhost:5173';
const userOrigin = process.env.CLIENT_USER_URL || 'http://localhost:5174';
const corsAllowList = [
  adminOrigin, 
  userOrigin,
  'https://mtc-userside.netlify.app',
  'https://mtc-adminside.netlify.app',
  'http://192.168.1.86:5173',
  'http://192.168.1.86:5174'
];
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (corsAllowList.includes(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware with custom Morgan format
const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] - :response-time ms ":referrer" ":user-agent" [RequestID: :req[x-request-id]]';

app.use(morgan(morganFormat, {
  stream: {
    write: (message) => {
      console.log(message.trim());
    }
  },
  skip: (req, res) => process.env.NODE_ENV === 'test'
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: AUTH_RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many authentication attempts from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

// Apply rate limiting (only in production)
if (process.env.NODE_ENV === 'production') {
  app.use('/api/v1/', generalLimiter);
  app.use('/api/v1/auth/login', authLimiter);
  app.use('/api/v1/customer-auth', authLimiter);
} else {
  console.log('⚠️  Rate limiting disabled in development mode');
}

// Serve static files (uploaded images)
const uploadDir = process.env.UPLOAD_DIR || './uploads';
app.use('/uploads', express.static(path.resolve(uploadDir)));

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({
    ok: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      requestId: req.requestId
    }
  });
});

// API Routes
const apiRouter = express.Router();

apiRouter.use('/auth', authRoutes);
apiRouter.use('/customer-auth', customerAuthRoutes);
apiRouter.use('/settings', settingsRoutes);
apiRouter.use('/branches', branchesRoutes);
apiRouter.use('/categories', categoriesRoutes);
apiRouter.use('/subcategories', subcategoriesRoutes);
apiRouter.use('/brands', brandsRoutes);
apiRouter.use('/products', productsRoutes);
apiRouter.use('/banners', bannersRoutes);
apiRouter.use('/banner', bannerCrudRoutes);
apiRouter.use('/offers', offersRoutes);
apiRouter.use('/new-arrivals', newArrivalsRoutes);
apiRouter.use('/audit', auditRoutes);
apiRouter.use('/upload', uploadRoutes);
apiRouter.use('/wishlist', wishlistRoutes);
apiRouter.use('/cart', cartRoutes);
apiRouter.use('/customers', customersRoutes);
apiRouter.use('/orders', orderRoutes);
apiRouter.use('/addresses', addressRoutes);

// Health check endpoint for Render
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Mount API routes
app.use('/api/v1', apiRouter);

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

export default app;

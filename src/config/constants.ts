export const JWT_EXPIRES_IN = '7d';
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 1000; // Increased for development
export const AUTH_RATE_LIMIT_MAX_REQUESTS = 50; // Increased for development
export const FILE_UPLOAD_MAX_SIZE = 5 * 1024 * 1024; // 5MB
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const ALLOWED_IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
export const SALT_ROUNDS = 10;

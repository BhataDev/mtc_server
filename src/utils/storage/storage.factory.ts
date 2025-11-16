import { IImageStorage, StorageConfig } from './storage.interface';
import { LocalStorage } from './local.storage';
import { S3Storage } from './s3.storage';
import { CloudinaryStorage } from './cloudinary.storage';

export class StorageFactory {
  private static instance: IImageStorage;

  static getStorage(config?: StorageConfig): IImageStorage {
    if (this.instance) {
      return this.instance;
    }

    // Default to local storage if no config provided
    const storageConfig = config || this.getConfigFromEnv();

    switch (storageConfig.type) {
      case 's3':
        if (!storageConfig.s3) {
          throw new Error('S3 configuration is missing');
        }
        this.instance = new S3Storage(
          storageConfig.s3.bucket,
          storageConfig.s3.accessKeyId,
          storageConfig.s3.secretAccessKey,
          storageConfig.s3.region
        );
        break;

      case 'cloudinary':
        if (!storageConfig.cloudinary) {
          throw new Error('Cloudinary configuration is missing');
        }
        this.instance = new CloudinaryStorage(
          storageConfig.cloudinary.cloudName,
          storageConfig.cloudinary.apiKey,
          storageConfig.cloudinary.apiSecret
        );
        break;

      case 'local':
      default:
        const uploadDir = storageConfig.local?.uploadDir || process.env.UPLOAD_DIR || './uploads';
        const urlPrefix = storageConfig.local?.urlPrefix || '/uploads';
        this.instance = new LocalStorage(uploadDir, urlPrefix);
        break;
    }

    return this.instance;
  }

  private static getConfigFromEnv(): StorageConfig {
    // Check environment variables to determine storage type
    if (process.env.AWS_S3_BUCKET) {
      return {
        type: 's3',
        s3: {
          bucket: process.env.AWS_S3_BUCKET,
          accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
          region: process.env.AWS_REGION || 'us-east-1'
        }
      };
    }

    if (process.env.CLOUDINARY_URL) {
      // Parse Cloudinary URL
      const match = process.env.CLOUDINARY_URL.match(/cloudinary:\/\/(\w+):(\w+)@(\w+)/);
      if (match) {
        return {
          type: 'cloudinary',
          cloudinary: {
            apiKey: match[1],
            apiSecret: match[2],
            cloudName: match[3]
          }
        };
      }
    }

    // Default to local storage
    return {
      type: 'local',
      local: {
        uploadDir: process.env.UPLOAD_DIR || './uploads',
        urlPrefix: '/uploads'
      }
    };
  }

  static resetInstance(): void {
    this.instance = null as any;
  }
}

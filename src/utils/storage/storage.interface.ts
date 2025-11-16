export interface IImageStorage {
  upload(file: Express.Multer.File, folder: string): Promise<string>;
  uploadMany(files: Express.Multer.File[], folder: string): Promise<string[]>;
  delete(url: string): Promise<void>;
  deleteMany(urls: string[]): Promise<void>;
}

export interface StorageConfig {
  type: 'local' | 's3' | 'cloudinary';
  local?: {
    uploadDir: string;
    urlPrefix: string;
  };
  s3?: {
    bucket: string;
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
  };
  cloudinary?: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
  };
}

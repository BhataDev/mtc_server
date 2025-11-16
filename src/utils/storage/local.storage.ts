import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as crypto from 'crypto';
import { IImageStorage } from './storage.interface';

const unlinkAsync = promisify(fs.unlink);
const mkdirAsync = promisify(fs.mkdir);

export class LocalStorage implements IImageStorage {
  private uploadDir: string;
  private urlPrefix: string;

  constructor(uploadDir: string, urlPrefix: string = '/uploads') {
    this.uploadDir = path.resolve(uploadDir);
    this.urlPrefix = urlPrefix;
    this.ensureUploadDir();
  }

  private async ensureUploadDir() {
    try {
      await mkdirAsync(this.uploadDir, { recursive: true });
    } catch (error) {
      console.error('Error creating upload directory:', error);
    }
  }

  private generateFileName(originalName: string): string {
    const ext = path.extname(originalName);
    const hash = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();
    return `${timestamp}-${hash}${ext}`;
  }

  async upload(file: Express.Multer.File, folder: string = ''): Promise<string> {
    const fileName = this.generateFileName(file.originalname);
    const folderPath = path.join(this.uploadDir, folder);
    
    // Ensure folder exists
    await mkdirAsync(folderPath, { recursive: true });
    
    const filePath = path.join(folderPath, fileName);
    
    // Move file from temp location to final destination
    await fs.promises.writeFile(filePath, file.buffer);
    
    // Return URL
    const url = folder 
      ? `${this.urlPrefix}/${folder}/${fileName}`
      : `${this.urlPrefix}/${fileName}`;
    
    return url.replace(/\\/g, '/');
  }

  async uploadMany(files: Express.Multer.File[], folder: string = ''): Promise<string[]> {
    return Promise.all(files.map(file => this.upload(file, folder)));
  }

  async delete(url: string): Promise<void> {
    try {
      // Extract file path from URL
      const relativePath = url.replace(this.urlPrefix, '').replace(/^\//, '');
      const filePath = path.join(this.uploadDir, relativePath);
      
      if (fs.existsSync(filePath)) {
        await unlinkAsync(filePath);
      }
    } catch (error) {
      console.error('Error deleting file:', error);
    }
  }

  async deleteMany(urls: string[]): Promise<void> {
    await Promise.all(urls.map(url => this.delete(url)));
  }
}

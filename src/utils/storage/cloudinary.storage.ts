import { IImageStorage } from './storage.interface';

export class CloudinaryStorage implements IImageStorage {
  // TODO: Implement Cloudinary storage
  // Required package: cloudinary
  
  constructor(cloudName: string, apiKey: string, apiSecret: string) {
    // TODO: Initialize Cloudinary
    // cloudinary.config({
    //   cloud_name: cloudName,
    //   api_key: apiKey,
    //   api_secret: apiSecret
    // });
    console.log('Cloudinary Storage initialized (not implemented yet)');
  }

  async upload(file: Express.Multer.File, folder: string = ''): Promise<string> {
    // TODO: Upload to Cloudinary
    // const result = await cloudinary.uploader.upload_stream(
    //   { folder, resource_type: 'image' },
    //   (error, result) => {
    //     if (error) throw error;
    //     return result.secure_url;
    //   }
    // ).end(file.buffer);
    
    throw new Error('Cloudinary storage not implemented yet');
  }

  async uploadMany(files: Express.Multer.File[], folder: string = ''): Promise<string[]> {
    return Promise.all(files.map(file => this.upload(file, folder)));
  }

  async delete(url: string): Promise<void> {
    // TODO: Delete from Cloudinary
    // const publicId = extractPublicIdFromUrl(url);
    // await cloudinary.uploader.destroy(publicId);
    
    throw new Error('Cloudinary storage not implemented yet');
  }

  async deleteMany(urls: string[]): Promise<void> {
    await Promise.all(urls.map(url => this.delete(url)));
  }
}

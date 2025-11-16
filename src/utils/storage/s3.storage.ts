import { IImageStorage } from './storage.interface';

export class S3Storage implements IImageStorage {
  // TODO: Implement S3 storage
  // Required packages: @aws-sdk/client-s3, @aws-sdk/lib-storage
  
  constructor(bucket: string, accessKeyId: string, secretAccessKey: string, region: string) {
    // TODO: Initialize S3 client
    console.log('S3 Storage initialized (not implemented yet)');
  }

  async upload(file: Express.Multer.File, folder: string = ''): Promise<string> {
    // TODO: Upload to S3
    // const key = `${folder}/${generateFileName(file.originalname)}`;
    // const uploadParams = {
    //   Bucket: this.bucket,
    //   Key: key,
    //   Body: file.buffer,
    //   ContentType: file.mimetype,
    // };
    // const result = await s3Client.upload(uploadParams).promise();
    // return result.Location;
    
    throw new Error('S3 storage not implemented yet');
  }

  async uploadMany(files: Express.Multer.File[], folder: string = ''): Promise<string[]> {
    return Promise.all(files.map(file => this.upload(file, folder)));
  }

  async delete(url: string): Promise<void> {
    // TODO: Delete from S3
    // const key = extractKeyFromUrl(url);
    // await s3Client.deleteObject({ Bucket: this.bucket, Key: key }).promise();
    
    throw new Error('S3 storage not implemented yet');
  }

  async deleteMany(urls: string[]): Promise<void> {
    // TODO: Batch delete from S3
    await Promise.all(urls.map(url => this.delete(url)));
  }
}

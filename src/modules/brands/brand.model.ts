import mongoose, { Schema, Document } from 'mongoose';

export interface IBrand extends Document {
  name: string;
  imageUrl?: string;
  isOwn: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BrandSchema = new Schema<IBrand>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    imageUrl: {
      type: String,
      required: false
    },
    isOwn: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

BrandSchema.index({ name: 1 });
BrandSchema.index({ isOwn: 1 });

export const Brand = mongoose.model<IBrand>('Brand', BrandSchema);

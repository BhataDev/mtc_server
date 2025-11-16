import mongoose, { Schema, Document } from 'mongoose';

export interface ICategory extends Document {
  name: string;
  imageUrl?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const CategorySchema = new Schema<ICategory>(
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
    isActive: {
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

CategorySchema.index({ name: 1 });
CategorySchema.index({ isActive: 1 });

export const Category = mongoose.model<ICategory>('Category', CategorySchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface ISubcategory extends Document {
  category: mongoose.Types.ObjectId;
  name: string;
  imageUrl?: string;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const SubcategorySchema = new Schema<ISubcategory>(
  {
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    name: {
      type: String,
      required: true,
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

// Compound unique index for category + name
SubcategorySchema.index({ category: 1, name: 1 }, { unique: true });
SubcategorySchema.index({ isActive: 1 });

export const Subcategory = mongoose.model<ISubcategory>('Subcategory', SubcategorySchema);

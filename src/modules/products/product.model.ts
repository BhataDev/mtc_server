import mongoose, { Schema, Document } from 'mongoose';

export interface IColor {
  name: string;
  hex: string;
}

export interface IProduct extends Document {
  productId: string;
  images?: string[];
  title: string;
  modelNumber?: string;
  category: mongoose.Types.ObjectId;
  subcategory: mongoose.Types.ObjectId;
  brand?: mongoose.Types.ObjectId;
  price: number;
  offerPrice?: number;
  isOwn: boolean;
  colors?: IColor[];
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const ColorSchema = new Schema<IColor>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    hex: {
      type: String,
      required: true,
      match: /^#[0-9A-F]{6}$/i
    }
  },
  { _id: false }
);

const ProductSchema = new Schema<IProduct>(
  {
    productId: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    images: {
      type: [String],
      default: []
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    modelNumber: {
      type: String,
      required: false,
      trim: true
    },
    category: {
      type: Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },
    subcategory: {
      type: Schema.Types.ObjectId,
      ref: 'Subcategory',
      required: true
    },
    brand: {
      type: Schema.Types.ObjectId,
      ref: 'Brand',
      required: false
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    offerPrice: {
      type: Number,
      min: 0,
      validate: {
        validator: function (value: number) {
          return !value || value < this.price;
        },
        message: 'Offer price must be less than regular price'
      }
    },
    isOwn: {
      type: Boolean,
      default: false
    },
    colors: [ColorSchema],
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

// Indexes for search and filtering
ProductSchema.index({ productId: 1 });
ProductSchema.index({ title: 'text' });
ProductSchema.index({ modelNumber: 1 }, { sparse: true }); // Sparse index for optional modelNumber
ProductSchema.index({ category: 1, subcategory: 1 });
ProductSchema.index({ brand: 1 });
ProductSchema.index({ isOwn: 1 });
ProductSchema.index({ isActive: 1 });
ProductSchema.index({ price: 1 });

// Utility function to generate subcategory abbreviation
export const generateSubcategoryAbbreviation = (subcategoryName: string): string => {
  // Remove special characters and split by spaces
  const words = subcategoryName
    .replace(/[^a-zA-Z\s]/g, '') // Remove non-alphabetic characters except spaces
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  if (words.length === 1) {
    // Single word: take first 3 characters
    return words[0].substring(0, 3).toUpperCase();
  } else if (words.length === 2) {
    // Two words: take first 2 chars from each word
    return (words[0].substring(0, 2) + words[1].substring(0, 2)).toUpperCase();
  } else if (words.length >= 3) {
    // Three or more words: take first char from each of first 3 words
    return (words[0].charAt(0) + words[1].charAt(0) + words[2].charAt(0)).toUpperCase();
  }
  
  // Fallback: take first 3 characters of the whole string
  return subcategoryName.replace(/[^a-zA-Z]/g, '').substring(0, 3).toUpperCase();
};

// Function to generate next product ID for a subcategory
export const generateProductId = async (subcategoryName: string): Promise<string> => {
  const prefix = generateSubcategoryAbbreviation(subcategoryName);
  
  // Find the highest existing product ID with this prefix
  const lastProduct = await Product.findOne(
    { productId: { $regex: `^${prefix}\\d+$` } },
    {},
    { sort: { productId: -1 } }
  );

  let nextNumber = 1;
  if (lastProduct && lastProduct.productId) {
    // Extract the number part and increment
    const match = lastProduct.productId.match(/(\d+)$/);
    if (match) {
      nextNumber = parseInt(match[1]) + 1;
    }
  }

  // Format with leading zeros (3 digits)
  return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
};

export const Product = mongoose.model<IProduct>('Product', ProductSchema);

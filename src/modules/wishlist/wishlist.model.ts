import mongoose, { Document, Schema } from 'mongoose';

export interface IWishlistItem {
  product: mongoose.Types.ObjectId;
  addedAt: Date;
}

export interface IWishlist extends Document {
  user: mongoose.Types.ObjectId;
  items: IWishlistItem[];
  createdAt: Date;
  updatedAt: Date;
}

const wishlistItemSchema = new Schema<IWishlistItem>({
  product: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  addedAt: {
    type: Date,
    default: Date.now
  }
});

const wishlistSchema = new Schema<IWishlist>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true
    },
    items: [wishlistItemSchema]
  },
  {
    timestamps: true
  }
);

// Index for efficient queries
wishlistSchema.index({ user: 1 });
wishlistSchema.index({ 'items.product': 1 });

// Ensure unique products in wishlist
wishlistSchema.methods.addProduct = function(productId: string) {
  const exists = this.items.some((item: IWishlistItem) => 
    item.product.toString() === productId
  );
  
  if (!exists) {
    this.items.push({ product: productId, addedAt: new Date() });
  }
  
  return this;
};

wishlistSchema.methods.removeProduct = function(productId: string) {
  this.items = this.items.filter((item: IWishlistItem) => 
    item.product.toString() !== productId
  );
  
  return this;
};

export const Wishlist = mongoose.model<IWishlist>('Wishlist', wishlistSchema);

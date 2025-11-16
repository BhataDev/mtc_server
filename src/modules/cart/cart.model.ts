import mongoose, { Schema, Document } from 'mongoose';

export interface ICartItem {
  product: mongoose.Types.ObjectId;
  quantity: number;
  price: number; // Price at the time of adding to cart
  subtotal: number; // price * quantity
}

export interface ICart extends Document {
  customer: mongoose.Types.ObjectId;
  items: ICartItem[];
  totalItems: number;
  totalAmount: number;
  createdAt: Date;
  updatedAt: Date;
  addItem(productId: mongoose.Types.ObjectId, quantity: number, price: number): void;
  updateItemQuantity(productId: mongoose.Types.ObjectId, quantity: number): boolean;
  removeItem(productId: mongoose.Types.ObjectId): boolean;
  clearCart(): void;
}

const CartItemSchema = new Schema<ICartItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
      default: 1
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0
    }
  },
  { _id: false }
);

const CartSchema = new Schema<ICart>(
  {
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'Customer',
      required: true,
      unique: true // Each customer can have only one cart
    },
    items: [CartItemSchema],
    totalItems: {
      type: Number,
      default: 0,
      min: 0
    },
    totalAmount: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

// Index for faster queries
CartSchema.index({ customer: 1 });
CartSchema.index({ 'items.product': 1 });

// Pre-save middleware to calculate totals
CartSchema.pre('save', function (next) {
  this.totalItems = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + item.subtotal, 0);
  next();
});

// Method to add item to cart
CartSchema.methods.addItem = function (productId: mongoose.Types.ObjectId, quantity: number, price: number) {
  const existingItemIndex = this.items.findIndex(
    (item: ICartItem) => item.product.toString() === productId.toString()
  );

  if (existingItemIndex > -1) {
    // Update existing item with current price (in case offer price changed)
    this.items[existingItemIndex].quantity += quantity;
    this.items[existingItemIndex].price = price; // Update to current price
    this.items[existingItemIndex].subtotal = price * this.items[existingItemIndex].quantity;
  } else {
    // Add new item
    this.items.push({
      product: productId,
      quantity,
      price,
      subtotal: price * quantity
    });
  }
};

// Method to update item quantity
CartSchema.methods.updateItemQuantity = function (productId: mongoose.Types.ObjectId, quantity: number) {
  const itemIndex = this.items.findIndex(
    (item: ICartItem) => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    if (quantity <= 0) {
      this.items.splice(itemIndex, 1);
    } else {
      this.items[itemIndex].quantity = quantity;
      this.items[itemIndex].subtotal = this.items[itemIndex].price * quantity;
    }
    return true;
  }
  return false;
};

// Method to remove item from cart
CartSchema.methods.removeItem = function (productId: mongoose.Types.ObjectId) {
  const itemIndex = this.items.findIndex(
    (item: ICartItem) => item.product.toString() === productId.toString()
  );

  if (itemIndex > -1) {
    this.items.splice(itemIndex, 1);
    return true;
  }
  return false;
};

// Method to clear cart
CartSchema.methods.clearCart = function () {
  this.items = [];
};

export const Cart = mongoose.model<ICart>('Cart', CartSchema);

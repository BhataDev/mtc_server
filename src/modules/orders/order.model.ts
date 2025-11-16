import mongoose, { Document, Schema } from 'mongoose';

export interface IOrderItem {
  product: mongoose.Types.ObjectId;
  title: string;
  price: number;
  offerPrice?: number;
  quantity: number;
  subtotal: number;
  image: string;
}

export interface IShippingAddress {
  firstName: string;
  lastName: string;
  email?: string;
  phone: string;
  companyName?: string;
  address: string;
  apartment?: string;
  district: string;
  buildingNumber: string;
  secondaryNumber?: string;
  postalCode?: string;
  crNumber?: string;
  vatNumber?: string;
  vatRegistered: boolean;
}

export interface IOrder extends Document {
  orderNumber: string;
  customer: mongoose.Types.ObjectId;
  branch?: mongoose.Types.ObjectId; // Assigned branch based on location
  items: IOrderItem[];
  shippingAddress: IShippingAddress;
  paymentMethod: 'mada' | 'emkan' | 'cod';
  subtotal: number;
  shipping: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'on_the_way' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'paid' | 'failed' | 'refunded';
  notes?: string;
  trackingNumber?: string;
  estimatedDelivery?: Date;
  deliveredAt?: Date;
  customerIpAddress?: string; // Customer's IP address for location tracking
  customerLocation?: {
    type: 'Point';
    coordinates: [number, number]; // [longitude, latitude]
  };
  createdAt: Date;
  updatedAt: Date;
}

const OrderItemSchema = new Schema<IOrderItem>({
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  title: { type: String, required: true },
  price: { type: Number, required: true },
  offerPrice: { type: Number },
  quantity: { type: Number, required: true, min: 1 },
  subtotal: { type: Number, required: true },
  image: { type: String, required: true }
});

const ShippingAddressSchema = new Schema<IShippingAddress>({
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  email: { type: String, required: false, trim: true, lowercase: true },
  phone: { type: String, required: true, trim: true },
  companyName: { type: String, trim: true },
  address: { type: String, required: true, trim: true },
  apartment: { type: String, trim: true },
  district: { type: String, required: true, trim: true },
  buildingNumber: { type: String, required: true, trim: true },
  secondaryNumber: { type: String, trim: true },
  postalCode: { type: String, required: false, trim: true },
  crNumber: { type: String, trim: true },
  vatNumber: { type: String, trim: true },
  vatRegistered: { type: Boolean, default: false }
});

const OrderSchema = new Schema<IOrder>({
  orderNumber: { 
    type: String, 
    unique: true,
    index: true
  },
  customer: { 
    type: Schema.Types.ObjectId, 
    ref: 'Customer', 
    required: true,
    index: true
  },
  branch: { 
    type: Schema.Types.ObjectId, 
    ref: 'Branch',
    index: true
  },
  items: [OrderItemSchema],
  shippingAddress: { type: ShippingAddressSchema, required: true },
  paymentMethod: { 
    type: String, 
    enum: ['mada', 'emkan', 'cod'], 
    required: true 
  },
  subtotal: { type: Number, required: true, min: 0 },
  shipping: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['pending', 'processing', 'shipped', 'delivered', 'cancelled'], 
    default: 'pending',
    index: true
  },
  paymentStatus: { 
    type: String, 
    enum: ['pending', 'paid', 'failed', 'refunded'], 
    default: 'pending',
    index: true
  },
  notes: { type: String, trim: true },
  trackingNumber: { type: String, trim: true },
  estimatedDelivery: { type: Date },
  deliveredAt: { type: Date },
  customerIpAddress: { type: String, trim: true },
  customerLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number],
      validate: {
        validator: function (val: number[]) {
          return val.length === 2;
        },
        message: 'Coordinates must be [longitude, latitude]'
      }
    }
  }
}, {
  timestamps: true
});

// Generate order number before saving
OrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    try {
      // Use this.constructor to avoid circular reference
      const count = await (this.constructor as any).countDocuments();
      this.orderNumber = `MTC${String(count + 1).padStart(6, '0')}`;
    } catch (error) {
      console.error('Error generating order number:', error);
      // Fallback to timestamp-based order number
      this.orderNumber = `MTC${Date.now()}`;
    }
  }
  next();
});

// Create 2dsphere index for geospatial queries
OrderSchema.index({ customerLocation: '2dsphere' });

// Indexes for better query performance
OrderSchema.index({ customer: 1, createdAt: -1 });
OrderSchema.index({ branch: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ 'shippingAddress.email': 1 });
OrderSchema.index({ 'shippingAddress.phone': 1 });

export const Order = mongoose.model<IOrder>('Order', OrderSchema);

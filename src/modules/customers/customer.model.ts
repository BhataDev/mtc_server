import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface ISavedAddress {
  _id?: string;
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
  isDefault?: boolean;
  addressLabel?: string; // e.g., "Home", "Office", "Warehouse"
}

export interface ICustomer extends Document {
  name: string;
  email: string;
  phone?: string;
  passwordHash?: string | null;
  googleId?: string | null;
  avatarUrl?: string | null;
  savedAddresses?: ISavedAddress[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const CustomerSchema = new Schema<ICustomer>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    phone: {
      type: String,
      default: null,
    },
    passwordHash: {
      type: String,
      default: null,
    },
    googleId: {
      type: String,
      default: null,
      index: true,
      unique: false,
    },
    avatarUrl: {
      type: String,
      default: null,
    },
    savedAddresses: [{
      firstName: { type: String, required: true },
      lastName: { type: String, required: true },
      email: { type: String, required: false },
      phone: { type: String, required: true },
      companyName: { type: String },
      address: { type: String, required: true },
      apartment: { type: String },
      district: { type: String, required: true },
      buildingNumber: { type: String, required: true },
      secondaryNumber: { type: String },
      postalCode: { type: String },
      crNumber: { type: String },
      vatNumber: { type: String },
      vatRegistered: { type: Boolean, default: false },
      isDefault: { type: Boolean, default: false },
      addressLabel: { type: String, default: 'Address' }
    }],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving if modified
CustomerSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash') || !this.passwordHash) {
    return next();
  }
  try {
    const salt = await bcrypt.genSalt(10);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error: any) {
    next(error);
  }
});

CustomerSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  if (!this.passwordHash) return false;
  return bcrypt.compare(password, this.passwordHash);
};

CustomerSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete (ret as any).passwordHash;
    return ret;
  },
});

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);

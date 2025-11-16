import mongoose, { Schema, Document } from 'mongoose';

export interface IBranch extends Document {
  name: string;
  username: string;
  passwordHash: string;
  phone: string;
  countryCode: string;
  phoneNumber: string;
  addressText: string;
  location: {
    type: string;
    coordinates: [number, number]; // [longitude, latitude]
  };
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BranchSchema = new Schema<IBranch>(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    passwordHash: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true
    },
    addressText: {
      type: String,
      required: true
    },
    location: {
      type: {
        type: String,
        enum: ['Point'],
        default: 'Point'
      },
      coordinates: {
        type: [Number],
        required: true,
        validate: {
          validator: function (val: number[]) {
            return val.length === 2;
          },
          message: 'Coordinates must be [longitude, latitude]'
        }
      }
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

// Create 2dsphere index for geospatial queries
BranchSchema.index({ location: '2dsphere' });
BranchSchema.index({ username: 1 });
BranchSchema.index({ isActive: 1 });

// Exclude password from JSON responses
BranchSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete (ret as any).passwordHash;
    return ret;
  }
});

export const Branch = mongoose.model<IBranch>('Branch', BranchSchema);

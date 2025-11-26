import mongoose, { Schema, Document } from 'mongoose';

export interface INewArrival extends Document {
  product: mongoose.Types.ObjectId;
  title: string;
  description: string;
  imageUrl: string;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  createdRole: 'admin' | 'branch';
  branch?: mongoose.Types.ObjectId; // null = global (admin), branchId = branch-specific
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const NewArrivalSchema = new Schema<INewArrival>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    imageUrl: {
      type: String,
      required: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    createdRole: {
      type: String,
      enum: ['admin', 'branch'],
      required: true
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null // null means it's a global new arrival created by admin
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

// Indexes
NewArrivalSchema.index({ isActive: 1 });
NewArrivalSchema.index({ branch: 1 });
NewArrivalSchema.index({ createdRole: 1 });

// Method to check if new arrival applies to a specific branch
NewArrivalSchema.methods.appliesToBranch = function (branchId: mongoose.Types.ObjectId | null): boolean {
  // Global new arrivals (branch = null) apply to all branches
  if (!this.branch) return true;
  // Branch-specific new arrivals only apply to that branch
  return this.branch.equals(branchId);
};

export const NewArrival = mongoose.model<INewArrival>('NewArrival', NewArrivalSchema);

import mongoose, { Schema, Document } from 'mongoose';

export interface IOfferItem {
  product: mongoose.Types.ObjectId;
  offerPrice?: number;
  percent?: number;
}

export interface IOfferCampaign extends Document {
  title: string;
  startsAt?: Date;
  endsAt?: Date;
  isActive: boolean;
  applyMode: 'perItem' | 'bulkPercent' | 'bulkAmount';
  bulkPercent?: number;
  bulkAmount?: number;
  items: IOfferItem[];
  
  // Targeting fields
  branches?: mongoose.Types.ObjectId[]; // Specific branches this offer applies to
  cities?: string[]; // Cities where this offer is valid
  geo?: {
    type: 'Point' | 'Polygon';
    coordinates: number[] | number[][];
    radiusMeters?: number; // For Point type - radius in meters
  };
  categoryIds?: mongoose.Types.ObjectId[]; // Categories this offer applies to
  productIds?: mongoose.Types.ObjectId[]; // Specific products (in addition to items)
  
  // Priority and stacking
  priority: number; // Higher number = higher priority (default 0)
  stackable: boolean; // Can this offer be combined with others? (default false)
  
  // Legacy support
  branch?: mongoose.Types.ObjectId; // Deprecated - use branches array instead
  
  createdBy: mongoose.Types.ObjectId;
  createdRole: 'admin' | 'branch';
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const OfferItemSchema = new Schema<IOfferItem>(
  {
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    offerPrice: {
      type: Number,
      min: 0
    },
    percent: {
      type: Number,
      min: 0,
      max: 100
    }
  },
  { _id: false }
);

const OfferCampaignSchema = new Schema<IOfferCampaign>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    startsAt: {
      type: Date,
      default: null
    },
    endsAt: {
      type: Date,
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    },
    applyMode: {
      type: String,
      enum: ['perItem', 'bulkPercent', 'bulkAmount'],
      required: true
    },
    bulkPercent: {
      type: Number,
      min: 0,
      max: 100,
      default: null
    },
    bulkAmount: {
      type: Number,
      min: 0,
      default: null
    },
    items: [OfferItemSchema],
    
    // Targeting fields
    branches: [{
      type: Schema.Types.ObjectId,
      ref: 'Branch'
    }],
    cities: [{
      type: String,
      trim: true
    }],
    geo: {
      type: {
        type: String,
        enum: ['Point', 'Polygon']
      },
      coordinates: {
        type: Schema.Types.Mixed
      },
      radiusMeters: {
        type: Number,
        min: 0
      }
    },
    categoryIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Category'
    }],
    productIds: [{
      type: Schema.Types.ObjectId,
      ref: 'Product'
    }],
    
    // Priority and stacking
    priority: {
      type: Number,
      default: 0
    },
    stackable: {
      type: Boolean,
      default: false
    },
    
    // Legacy support
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null
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
OfferCampaignSchema.index({ isActive: 1 });
OfferCampaignSchema.index({ branch: 1 });
OfferCampaignSchema.index({ branches: 1 });
OfferCampaignSchema.index({ cities: 1 });
OfferCampaignSchema.index({ startsAt: 1, endsAt: 1 });
OfferCampaignSchema.index({ priority: -1 }); // Descending for sorting
OfferCampaignSchema.index({ createdRole: 1 });
OfferCampaignSchema.index({ categoryIds: 1 });
OfferCampaignSchema.index({ productIds: 1 });

// 2dsphere index for geo queries
OfferCampaignSchema.index({ 'geo.coordinates': '2dsphere' });

// Virtual to check if offer is currently valid
OfferCampaignSchema.virtual('isCurrentlyValid').get(function () {
  const now = new Date();
  const startValid = !this.startsAt || this.startsAt <= now;
  const endValid = !this.endsAt || this.endsAt >= now;
  return this.isActive && startValid && endValid;
});

// Method to check if offer applies to a specific branch
OfferCampaignSchema.methods.appliesToBranch = function (branchId: mongoose.Types.ObjectId | null): boolean {
  // Global offers (branch = null) apply to all branches
  if (!this.branch) return true;
  // Branch-specific offers only apply to that branch
  return this.branch.equals(branchId);
};

export const OfferCampaign = mongoose.model<IOfferCampaign>('OfferCampaign', OfferCampaignSchema);

import mongoose, { Schema, Document, Model } from 'mongoose';

// Individual Banner Interface (for both global and branch banners)
export interface IBanner extends Document {
  imageUrlDesktop: string;
  imageUrlTablet: string;
  imageUrlMobile: string;
  buttonUrl: string;
  title?: string;
  description?: string;
  branch?: mongoose.Types.ObjectId; // null for global banners
  isActive: boolean;
  order: number;
  createdBy: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

// Legacy interfaces for backward compatibility
export interface IBranchBanner extends Document {
  branch: mongoose.Types.ObjectId;
  banners: Array<{
    imageUrl: string;
    linkUrl: string;
    order: number;
  }>;
  isActive: boolean;
  createdBy?: mongoose.Types.ObjectId;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGlobalBanner extends Document {
  banners: Array<{
    imageUrl: string;
    buttonUrl: string;
    title?: string;
    description?: string;
    order: number;
  }>;
  isActive: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IGlobalBannerModel extends Model<IGlobalBanner> {
  getInstance(): Promise<IGlobalBanner>;
}

// New Individual Banner Schema (for CRUD operations)
const BannerSchema = new Schema<IBanner>(
  {
    imageUrlDesktop: {
      type: String,
      required: true
    },
    imageUrlTablet: {
      type: String,
      required: true
    },
    imageUrlMobile: {
      type: String,
      required: true
    },
    buttonUrl: {
      type: String,
      required: true,
      default: '#'
    },
    title: {
      type: String,
      default: ''
    },
    description: {
      type: String,
      default: ''
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null // null for global banners
    },
    isActive: {
      type: Boolean,
      default: true
    },
    order: {
      type: Number,
      default: 0
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
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

// Legacy Branch Banner Schema (for backward compatibility)
const BranchBannerSchema = new Schema<IBranchBanner>(
  {
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
      unique: true
    },
    banners: [
      {
        imageUrl: {
          type: String,
          required: true
        },
        linkUrl: {
          type: String,
          default: '#'
        },
        order: {
          type: Number,
          default: 0
        }
      }
    ],
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

// Global Banner Schema
const GlobalBannerSchema = new Schema<IGlobalBanner>(
  {
    banners: [
      {
        imageUrl: {
          type: String,
          required: true
        },
        buttonUrl: {
          type: String,
          default: '#'
        },
        title: {
          type: String,
          default: ''
        },
        description: {
          type: String,
          default: ''
        },
        order: {
          type: Number,
          default: 0
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
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

// Static method to ensure only one global banner exists
GlobalBannerSchema.statics.getInstance = async function () {
  let banner = await this.findOne();
  if (!banner) {
    banner = await this.create({
      banners: [
        {
          imageUrl: '/placeholder-global-banner.jpg',
          buttonUrl: '#',
          title: 'Welcome to MTC',
          description: 'Discover our amazing products',
          order: 0
        }
      ]
    });
  }
  return banner;
};

// Indexes for performance
BannerSchema.index({ branch: 1 });
BannerSchema.index({ isActive: 1 });
BannerSchema.index({ order: 1 });
BannerSchema.index({ createdAt: -1 });

BranchBannerSchema.index({ branch: 1 });
BranchBannerSchema.index({ isActive: 1 });

// Export models
export const Banner = mongoose.model<IBanner>('Banner', BannerSchema);
export const BranchBanner = mongoose.model<IBranchBanner>('BranchBanner', BranchBannerSchema);
export const GlobalBanner = mongoose.model<IGlobalBanner, IGlobalBannerModel>('GlobalBanner', GlobalBannerSchema);

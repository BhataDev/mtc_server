import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  actorUser: mongoose.Types.ObjectId;
  actorRole: 'admin' | 'branch';
  entity: 'Settings' | 'Branch' | 'Category' | 'Subcategory' | 'Brand' | 'Product' | 
          'OfferCampaign' | 'BranchBanner' | 'GlobalBanner' | 'NewArrival' | 'User' | 'Banner';
  entityId: mongoose.Types.ObjectId;
  action: 'create' | 'update' | 'delete';
  diff?: any; // JSON object showing what changed
  metadata?: any; // Additional context data
  at: Date;
  ipAddress?: string;
  userAgent?: string;
}

const AuditLogSchema = new Schema<IAuditLog>(
  {
    actorUser: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    actorRole: {
      type: String,
      enum: ['admin', 'branch'],
      required: true
    },
    entity: {
      type: String,
      enum: [
        'Settings', 'Branch', 'Category', 'Subcategory', 'Brand', 'Product',
        'OfferCampaign', 'BranchBanner', 'GlobalBanner', 'NewArrival', 'User', 'Banner', 'Customer'
      ],
      required: true
    },
    entityId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    action: {
      type: String,
      enum: ['create', 'update', 'delete'],
      required: true
    },
    diff: {
      type: Schema.Types.Mixed,
      default: {}
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {}
    },
    at: {
      type: Date,
      default: Date.now,
      required: true
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: false // We use 'at' field instead
  }
);

// Indexes for efficient querying
AuditLogSchema.index({ entity: 1, entityId: 1 });
AuditLogSchema.index({ actorUser: 1 });
AuditLogSchema.index({ actorRole: 1 });
AuditLogSchema.index({ at: -1 }); // Most recent first
AuditLogSchema.index({ entity: 1, action: 1, at: -1 });

export const AuditLog = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);

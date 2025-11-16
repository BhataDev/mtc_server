import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISettings extends Document {
  vatPercentage: number;
  shippingChargeSAR: number;
  freeShippingForOwnBrands: boolean;
  updatedBy?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISettingsModel extends Model<ISettings> {
  getInstance(): Promise<ISettings>;
}

const SettingsSchema = new Schema<ISettings>(
  {
    vatPercentage: {
      type: Number,
      required: true,
      default: 15,
      min: 0,
      max: 100
    },
    shippingChargeSAR: {
      type: Number,
      required: true,
      default: 10,
      min: 0
    },
    freeShippingForOwnBrands: {
      type: Boolean,
      required: true,
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

// Ensure only one settings document exists
SettingsSchema.statics.getInstance = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({
      vatPercentage: 15,
      shippingChargeSAR: 10,
      freeShippingForOwnBrands: true
    });
  }
  return settings;
};

export const Settings = mongoose.model<ISettings, ISettingsModel>('Settings', SettingsSchema);

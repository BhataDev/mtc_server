import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  username: string;
  passwordHash: string;
  role: 'admin' | 'branch';
  phone?: string;
  branch?: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  comparePassword(password: string): Promise<boolean>;
}

const UserSchema = new Schema<IUser>(
  {
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
    role: {
      type: String,
      enum: ['admin', 'branch'],
      required: true
    },
    phone: {
      type: String,
      trim: true
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      default: null
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
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

// Compare password method
UserSchema.methods.comparePassword = async function (password: string): Promise<boolean> {
  return bcrypt.compare(password, this.passwordHash);
};

// Exclude password from JSON responses
UserSchema.set('toJSON', {
  transform: function (doc, ret) {
    delete (ret as any).passwordHash;
    return ret;
  }
});

export const User = mongoose.model<IUser>('User', UserSchema);

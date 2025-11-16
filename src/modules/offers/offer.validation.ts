import { z } from 'zod';

export const createOfferSchema = z.object({
  title: z.string()
    .min(2, 'Title must be at least 2 characters long')
    .max(100, 'Title cannot exceed 100 characters'),
  
  startsAt: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === '') return true;
      return !isNaN(Date.parse(val));
    }, 'Start date must be a valid date'),
  
  endsAt: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === '') return true;
      return !isNaN(Date.parse(val));
    }, 'End date must be a valid date'),
  
  applyMode: z.enum(['perItem', 'bulkPercent', 'bulkAmount']),
  
  bulkPercent: z.number()
    .min(0, 'Bulk percent must be at least 0')
    .max(100, 'Bulk percent cannot exceed 100')
    .optional(),
  
  bulkAmount: z.number()
    .min(0, 'Bulk amount must be at least 0')
    .optional(),
  
  branch: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Branch must be a valid ObjectId')
    .optional(),
  
  items: z.array(
    z.object({
      product: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Product must be a valid ObjectId'),
      
      offerPrice: z.number()
        .min(0, 'Offer price must be at least 0')
        .optional(),
      
      percent: z.number()
        .min(0, 'Discount percent must be at least 0')
        .max(100, 'Discount percent cannot exceed 100')
        .optional()
    })
  ).min(1, 'At least one product is required')
}).refine((data) => {
  if (data.applyMode === 'bulkPercent' && !data.bulkPercent) {
    return false;
  }
  if (data.applyMode === 'bulkAmount' && !data.bulkAmount) {
    return false;
  }
  return true;
}, {
  message: 'Bulk percent or amount is required based on apply mode'
});

export const updateOfferSchema = z.object({
  title: z.string()
    .min(2, 'Title must be at least 2 characters long')
    .max(100, 'Title cannot exceed 100 characters')
    .optional(),
  
  startsAt: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === '') return true;
      return !isNaN(Date.parse(val));
    }, 'Start date must be a valid date'),
  
  endsAt: z.string()
    .optional()
    .refine((val) => {
      if (!val || val === '') return true;
      return !isNaN(Date.parse(val));
    }, 'End date must be a valid date'),
  
  isActive: z.boolean().optional(),
  
  applyMode: z.enum(['perItem', 'bulkPercent', 'bulkAmount']).optional(),
  
  bulkPercent: z.number()
    .min(0, 'Bulk percent must be at least 0')
    .max(100, 'Bulk percent cannot exceed 100')
    .optional(),
  
  bulkAmount: z.number()
    .min(0, 'Bulk amount must be at least 0')
    .optional(),
  
  branch: z.string()
    .regex(/^[0-9a-fA-F]{24}$/, 'Branch must be a valid ObjectId')
    .optional(),
  
  items: z.array(
    z.object({
      product: z.string()
        .regex(/^[0-9a-fA-F]{24}$/, 'Product must be a valid ObjectId'),
      
      offerPrice: z.number()
        .min(0, 'Offer price must be at least 0')
        .optional(),
      
      percent: z.number()
        .min(0, 'Discount percent must be at least 0')
        .max(100, 'Discount percent cannot exceed 100')
        .optional()
    })
  ).optional()
});

export const extendOfferSchema = z.object({
  endsAt: z.string()
    .datetime('End date must be a valid date')
});

export const toggleStatusSchema = z.object({
  isActive: z.boolean()
});

// TypeScript types for request bodies
export interface CreateOfferDto {
  title: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  applyMode: 'perItem' | 'bulkPercent' | 'bulkAmount';
  bulkPercent?: number | null;
  bulkAmount?: number | null;
  branch?: string | null;
  items: {
    product: string;
    offerPrice?: number;
    percent?: number;
  }[];
}

export interface UpdateOfferDto {
  title?: string;
  startsAt?: Date | null;
  endsAt?: Date | null;
  isActive?: boolean;
  applyMode?: 'perItem' | 'bulkPercent' | 'bulkAmount';
  bulkPercent?: number | null;
  bulkAmount?: number | null;
  branch?: string | null;
  items?: {
    product: string;
    offerPrice?: number;
    percent?: number;
  }[];
}

export interface ExtendOfferDto {
  endsAt: Date;
}

export interface ToggleStatusDto {
  isActive: boolean;
}

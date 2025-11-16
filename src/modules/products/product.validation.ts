import { z } from 'zod';

const colorSchema = z.object({
  name: z.string().min(1).max(50),
  hex: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid hex color')
});

export const createProductSchema = z.object({
  title: z.string().min(2).max(200),
  modelNumber: z.string().min(1).max(100).optional(),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  subcategory: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid subcategory ID'),
  brand: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid brand ID').optional(),
  price: z.number().min(0),
  offerPrice: z.number().min(0).optional(),
  isOwn: z.boolean().default(false),
  colors: z.array(colorSchema).optional(),
  images: z.array(z.string()).optional()
});

export const updateProductSchema = z.object({
  title: z.string().min(2).max(200).optional(),
  modelNumber: z.string().min(1).max(100).optional(),
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID').optional(),
  subcategory: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid subcategory ID').optional(),
  brand: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid brand ID').optional(),
  price: z.number().min(0).optional(),
  offerPrice: z.number().min(0).nullable().optional(),
  isOwn: z.boolean().optional(),
  colors: z.array(colorSchema).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional()
});

export const productQuerySchema = z.object({
  category: z.string().optional(),
  subcategory: z.string().optional(),
  brand: z.string().optional(),
  q: z.string().optional(),
  isOwn: z.string().optional(),
  isActive: z.string().optional(),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  page: z.string().default('1'),
  limit: z.string().default('20')
});

export type CreateProductDto = z.infer<typeof createProductSchema>;
export type UpdateProductDto = z.infer<typeof updateProductSchema>;
export type ProductQueryDto = z.infer<typeof productQuerySchema>;

import { z } from 'zod';

export const createSubcategorySchema = z.object({
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID'),
  name: z.string().min(2).max(100),
  imageUrl: z.string().url().optional()
});

export const updateSubcategorySchema = z.object({
  category: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid category ID').optional(),
  name: z.string().min(2).max(100).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
});

export type CreateSubcategoryDto = z.infer<typeof createSubcategorySchema>;
export type UpdateSubcategoryDto = z.infer<typeof updateSubcategorySchema>;

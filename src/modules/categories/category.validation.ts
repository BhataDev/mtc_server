import { z } from 'zod';

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  imageUrl: z.string().url().optional()
});

export const updateCategorySchema = z.object({
  name: z.string().min(2).max(100).optional(),
  imageUrl: z.string().url().optional(),
  isActive: z.boolean().optional()
});

export type CreateCategoryDto = z.infer<typeof createCategorySchema>;
export type UpdateCategoryDto = z.infer<typeof updateCategorySchema>;

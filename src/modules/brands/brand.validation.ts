import { z } from 'zod';

export const createBrandSchema = z.object({
  name: z.string().min(2).max(100),
  imageUrl: z.string().optional(),
  image: z.any().optional(),
  isOwn: z.boolean().optional()
});

export const updateBrandSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  imageUrl: z.string().optional(),
  image: z.any().optional(),
  isOwn: z.boolean().optional()
});

export type CreateBrandDto = z.infer<typeof createBrandSchema>;
export type UpdateBrandDto = z.infer<typeof updateBrandSchema>;

import { z } from 'zod';

export const createBranchSchema = z.object({
  name: z.string().min(2).max(100),
  username: z.string().min(3).max(50).toLowerCase(),
  password: z.string().min(6).max(100),
  phone: z.string().min(10).max(20),
  countryCode: z.string().min(2).max(3),
  phoneNumber: z.string().min(5).max(15),
  addressText: z.string().min(5).max(500),
  location: z.object({
    type: z.string().default('Point'),
    coordinates: z.array(z.number()).length(2)
  })
});

export const updateBranchSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  password: z.string().min(6).max(100).optional(),
  phone: z.string().min(10).max(20).optional(),
  countryCode: z.string().min(2).max(3).optional(),
  phoneNumber: z.string().min(5).max(15).optional(),
  addressText: z.string().min(5).max(500).optional(),
  location: z.object({
    type: z.string().default('Point'),
    coordinates: z.array(z.number()).length(2)
  }).optional()
});

export const resetPasswordSchema = z.object({
  newPassword: z.string().min(6).max(100)
});

export const updateStatusSchema = z.object({
  isActive: z.boolean()
});

export type CreateBranchDto = z.infer<typeof createBranchSchema>;
export type UpdateBranchDto = z.infer<typeof updateBranchSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;

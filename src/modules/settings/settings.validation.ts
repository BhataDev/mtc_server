import { z } from 'zod';

export const updateSettingsSchema = z.object({
  vatPercentage: z.number().min(0).max(100).optional(),
  shippingChargeSAR: z.number().min(0).optional(),
  freeShippingForOwnBrands: z.boolean().optional()
});

export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

import { z } from 'zod';

export const customerSignupSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(100),
});

export const customerLoginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(6).max(100),
});

export const googleIdTokenSchema = z.object({
  idToken: z.string().min(10),
});

export type CustomerSignupDto = z.infer<typeof customerSignupSchema>;
export type CustomerLoginDto = z.infer<typeof customerLoginSchema>;
export type GoogleIdTokenDto = z.infer<typeof googleIdTokenSchema>;

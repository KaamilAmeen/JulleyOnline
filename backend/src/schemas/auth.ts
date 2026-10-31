import { z } from 'zod';

const email = z.string().trim().toLowerCase().email('Enter a valid email address').max(255);

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120),
  email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be at most 72 characters')
    .regex(/[a-zA-Z]/, 'Password must contain a letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required').max(72),
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  avatarColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like #6366f1')
    .optional(),
});

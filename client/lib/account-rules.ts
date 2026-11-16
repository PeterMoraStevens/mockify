import { z } from "zod";

// Shared by sign-up and profile editing (browser-safe).
export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(32, "Username can be at most 32 characters")
  .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, digits, _ . - only");
export const displayNameSchema = z.string().trim().min(1, "Display name can't be empty").max(60);
export const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(200);

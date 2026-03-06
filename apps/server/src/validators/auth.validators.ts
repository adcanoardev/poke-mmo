import { z } from "zod";

export const RegisterBody = z.object({
    username: z
        .string()
        .min(3)
        .max(20)
        .regex(/^[a-zA-Z0-9_]+$/, "Only letters, numbers and underscores"),
    email: z.string().email(),
    password: z.string().min(6).max(100),
});

export const LoginBody = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

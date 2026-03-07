import { prisma } from "./prisma.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getOrCreateTrainer } from "./trainerService.js";

const SALT_ROUNDS = 12;
const JWT_SECRET = process.env.JWT_SECRET ?? "dev_secret_change_me";
const JWT_EXPIRES = "7d";

export type JwtPayload = {
    userId: string;
    username: string;
};

export async function registerUser(username: string, email: string, password: string) {
    const existing = await prisma.user.findFirst({
        where: { OR: [{ username }, { email }] },
    });
    if (existing) throw new Error("Username or email already taken");

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await prisma.user.create({
        data: { username, email, passwordHash },
    });
    await getOrCreateTrainer(user.id);

    return { token: signToken(user.id, user.username), username: user.username };
}

export async function loginUser(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error("Invalid credentials");
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new Error("Invalid credentials");
    return { token: signToken(user.id, user.username), username: user.username };
}

export async function getUserById(userId: string) {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, username: true, email: true, createdAt: true },
    });
    if (!user) return null;
    const trainer = await prisma.trainerProfile.findUnique({
        where: { userId },
        select: { onboardingComplete: true, avatar: true, gender: true },
    });
    return { ...user, onboardingComplete: trainer?.onboardingComplete ?? false };
}

function signToken(userId: string, username: string): string {
    return jwt.sign({ userId, username } satisfies JwtPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

// lib/prisma.ts
import { PrismaClient } from "@prisma/client";

// Use a global variable to avoid creating multiple PrismaClients during hot-reload in dev
const g = globalThis as unknown as { prisma?: PrismaClient };

// Create the client or reuse the global one
const prisma = g.prisma ?? new PrismaClient({ log: ["warn", "error"] });

// In development, attach PrismaClient to globalThis so it persists across reloads
if (process.env.NODE_ENV !== "production") {
  g.prisma = prisma;
}

// ✅ Default export so you can `import prisma from "@/lib/prisma"`
export default prisma;

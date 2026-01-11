import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

// In development, reuse the Prisma client to prevent multiple connections
// In production, always create a new client
const prisma = global.prisma || new PrismaClient();

// Store the client in global to reuse in development (hot reloading)
if (process.env.NODE_ENV !== "production") {
  global.prisma = prisma;
}

export default prisma;
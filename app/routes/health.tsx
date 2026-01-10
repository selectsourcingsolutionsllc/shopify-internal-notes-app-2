import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import prisma from "../db.server";

export async function loader({ request }: LoaderFunctionArgs) {
  try {
    // Check database connection by running a simple query
    await prisma.$queryRaw`SELECT 1`;

    return json(
      {
        status: "healthy",
        database: "connected",
        timestamp: new Date().toISOString()
      },
      { status: 200 }
    );
  } catch (error) {
    // If database check fails, return 503 (service unavailable)
    return json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}

// CodeRabbit review trigger - safe to remove

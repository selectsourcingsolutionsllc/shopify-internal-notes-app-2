import type { LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";
import { createObjectCsvStringifier } from "csv-writer";

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  
  const url = new URL(request.url);
  const startDate = url.searchParams.get("startDate");
  const endDate = url.searchParams.get("endDate");
  
  const where = {
    shopDomain: session.shop,
    ...(startDate && {
      timestamp: {
        gte: new Date(startDate),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };
  
  const auditLogs = await prisma.auditLog.findMany({
    where,
    orderBy: { timestamp: "desc" },
  });
  
  const csvStringifier = createObjectCsvStringifier({
    header: [
      { id: "timestamp", title: "Timestamp" },
      { id: "action", title: "Action" },
      { id: "entityType", title: "Entity Type" },
      { id: "entityId", title: "Entity ID" },
      { id: "userEmail", title: "User Email" },
      { id: "userId", title: "User ID" },
      { id: "oldValue", title: "Old Value" },
      { id: "newValue", title: "New Value" },
    ],
  });
  
  const records = auditLogs.map((log) => ({
    timestamp: format(new Date(log.timestamp), "yyyy-MM-dd HH:mm:ss"),
    action: log.action,
    entityType: log.entityType,
    entityId: log.entityId,
    userEmail: log.userEmail || "",
    userId: log.userId,
    oldValue: log.oldValue ? JSON.stringify(log.oldValue) : "",
    newValue: log.newValue ? JSON.stringify(log.newValue) : "",
  }));
  
  const csvContent = csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  
  return new Response(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="audit-log-${format(new Date(), "yyyy-MM-dd")}.csv"`,
    },
  });
}
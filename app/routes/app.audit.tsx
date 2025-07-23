import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, Form, useSearchParams } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  DataTable,
  Filters,
  DatePicker,
  Button,
  Pagination,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";
import { useState, useCallback } from "react";

const ITEMS_PER_PAGE = 50;

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const page = parseInt(searchParams.get("page") || "1");
  const entityType = searchParams.get("entityType") || "";
  const action = searchParams.get("action") || "";
  const startDate = searchParams.get("startDate") || "";
  const endDate = searchParams.get("endDate") || "";
  
  const where = {
    shopDomain: session.shop,
    ...(entityType && { entityType }),
    ...(action && { action }),
    ...(startDate && {
      timestamp: {
        gte: new Date(startDate),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };
  
  const [auditLogs, totalCount] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { timestamp: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
    }),
    prisma.auditLog.count({ where }),
  ]);
  
  return json({
    auditLogs,
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
  });
}

export default function AuditLog() {
  const { auditLogs, totalCount, currentPage, totalPages } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  
  const [selectedDates, setSelectedDates] = useState({
    start: searchParams.get("startDate") ? new Date(searchParams.get("startDate")!) : null,
    end: searchParams.get("endDate") ? new Date(searchParams.get("endDate")!) : null,
  });
  
  const handleMonthChange = useCallback((month: number, year: number) => {
    // Handle month change if needed
  }, []);
  
  const handleExport = () => {
    const params = new URLSearchParams(searchParams);
    window.location.href = `/app/audit/export?${params.toString()}`;
  };
  
  const rows = auditLogs.map((log) => [
    format(new Date(log.timestamp), "MMM dd, yyyy HH:mm"),
    log.action,
    log.entityType.replace(/_/g, " ").toLowerCase(),
    log.userEmail || log.userId,
    <Button
      size="slim"
      variant="plain"
      onClick={() => {
        const details = {
          old: log.oldValue,
          new: log.newValue,
        };
        console.log("Audit details:", details);
        alert(JSON.stringify(details, null, 2));
      }}
    >
      View Details
    </Button>,
  ]);
  
  return (
    <Page
      title="Audit Log"
      breadcrumbs={[{ content: "Dashboard", url: "/app" }]}
      primaryAction={{
        content: "Export CSV",
        onAction: handleExport,
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Form method="get">
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: "16px", alignItems: "end" }}>
                  <Filters
                    queryValue=""
                    filters={[]}
                    appliedFilters={[]}
                    onQueryChange={() => {}}
                    onQueryClear={() => {}}
                    onClearAll={() => {}}
                  >
                    <div style={{ minWidth: "200px" }}>
                      <label>
                        <span style={{ display: "block", marginBottom: "4px" }}>Entity Type</span>
                        <select
                          name="entityType"
                          defaultValue={searchParams.get("entityType") || ""}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #c9cccf",
                            borderRadius: "4px",
                          }}
                        >
                          <option value="">All Types</option>
                          <option value="PRODUCT_NOTE">Product Note</option>
                          <option value="ORDER_ACKNOWLEDGMENT">Acknowledgment</option>
                          <option value="APP_SETTINGS">Settings</option>
                        </select>
                      </label>
                    </div>
                    
                    <div style={{ minWidth: "200px" }}>
                      <label>
                        <span style={{ display: "block", marginBottom: "4px" }}>Action</span>
                        <select
                          name="action"
                          defaultValue={searchParams.get("action") || ""}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #c9cccf",
                            borderRadius: "4px",
                          }}
                        >
                          <option value="">All Actions</option>
                          <option value="CREATE">Create</option>
                          <option value="UPDATE">Update</option>
                          <option value="DELETE">Delete</option>
                          <option value="ACKNOWLEDGE">Acknowledge</option>
                        </select>
                      </label>
                    </div>
                    
                    <div style={{ minWidth: "200px" }}>
                      <label>
                        <span style={{ display: "block", marginBottom: "4px" }}>Start Date</span>
                        <input
                          type="date"
                          name="startDate"
                          defaultValue={searchParams.get("startDate") || ""}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #c9cccf",
                            borderRadius: "4px",
                          }}
                        />
                      </label>
                    </div>
                    
                    <div style={{ minWidth: "200px" }}>
                      <label>
                        <span style={{ display: "block", marginBottom: "4px" }}>End Date</span>
                        <input
                          type="date"
                          name="endDate"
                          defaultValue={searchParams.get("endDate") || ""}
                          style={{
                            width: "100%",
                            padding: "8px",
                            border: "1px solid #c9cccf",
                            borderRadius: "4px",
                          }}
                        />
                      </label>
                    </div>
                    
                    <Button submit primary>Filter</Button>
                  </Filters>
                </div>
              </Form>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#6d7175" }}>
                  Showing {auditLogs.length} of {totalCount} entries
                </p>
              </div>
              
              {auditLogs.length > 0 ? (
                <>
                  <DataTable
                    columnContentTypes={["text", "text", "text", "text", "text"]}
                    headings={["Timestamp", "Action", "Type", "User", "Details"]}
                    rows={rows}
                  />
                  
                  {totalPages > 1 && (
                    <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
                      <Pagination
                        hasPrevious={currentPage > 1}
                        hasNext={currentPage < totalPages}
                        onPrevious={() => {
                          const params = new URLSearchParams(searchParams);
                          params.set("page", String(currentPage - 1));
                          window.location.href = `/app/audit?${params.toString()}`;
                        }}
                        onNext={() => {
                          const params = new URLSearchParams(searchParams);
                          params.set("page", String(currentPage + 1));
                          window.location.href = `/app/audit?${params.toString()}`;
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p style={{ textAlign: "center", padding: "40px", color: "#6d7175" }}>
                  No audit log entries found matching your filters.
                </p>
              )}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
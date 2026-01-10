import { json } from "@remix-run/node";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form, useSubmit } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  TextField,
  Button,
  DataTable,
  Pagination,
  Filters,
  ChoiceList,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { format } from "date-fns";
import { useState, useCallback } from "react";

const ITEMS_PER_PAGE = 20;

export async function loader({ request }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  
  const page = parseInt(searchParams.get("page") || "1");
  const search = searchParams.get("search") || "";
  const hasPhotos = searchParams.get("hasPhotos") || "all";
  
  const where = {
    shopDomain: session.shop,
    ...(search && {
      OR: [
        { content: { contains: search, mode: "insensitive" as const } },
        { productId: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(hasPhotos === "yes" && { photos: { some: {} } }),
    ...(hasPhotos === "no" && { photos: { none: {} } }),
  };
  
  const [productNotes, totalCount] = await Promise.all([
    prisma.productNote.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * ITEMS_PER_PAGE,
      take: ITEMS_PER_PAGE,
      include: {
        photos: true,
        _count: {
          select: { auditLogs: true },
        },
      },
    }),
    prisma.productNote.count({ where }),
  ]);
  
  return json({ 
    productNotes, 
    totalCount,
    currentPage: page,
    totalPages: Math.ceil(totalCount / ITEMS_PER_PAGE),
  });
}

export default function NotesIndex() {
  const { productNotes, totalCount, currentPage, totalPages } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");
  const [hasPhotosFilter, setHasPhotosFilter] = useState(searchParams.get("hasPhotos") || "all");
  
  const handleSearchChange = useCallback((value: string) => {
    setSearchValue(value);
  }, []);
  
  const handleFilterSubmit = useCallback(() => {
    const formData = new FormData();
    formData.append("search", searchValue);
    formData.append("hasPhotos", hasPhotosFilter);
    formData.append("page", "1");
    submit(formData, { method: "get" });
  }, [searchValue, hasPhotosFilter, submit]);
  
  const handleClearFilters = useCallback(() => {
    setSearchValue("");
    setHasPhotosFilter("all");
    submit(new FormData(), { method: "get" });
  }, [submit]);
  
  const handleHasPhotosChange = useCallback((value: string[]) => {
    setHasPhotosFilter(value[0] || "all");
  }, []);
  
  const rows = productNotes.map((note) => [
    note.productId,
    <div style={{ maxWidth: "300px" }}>
      {note.content.substring(0, 100)}
      {note.content.length > 100 && "..."}
    </div>,
    note.photos.length,
    note._count.auditLogs,
    format(new Date(note.updatedAt), "MMM dd, yyyy HH:mm"),
    note.updatedBy,
    <Button size="slim" url={`/app/notes/${note.id}`}>View</Button>,
  ]);
  
  return (
    <Page
      title="Product Notes"
      primaryAction={{
        content: "Export to CSV",
        url: "/app/notes/export",
      }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <Filters
                queryValue={searchValue}
                filters={[
                  {
                    key: "hasPhotos",
                    label: "Has Photos",
                    filter: (
                      <ChoiceList
                        title="Has Photos"
                        titleHidden
                        choices={[
                          { label: "All notes", value: "all" },
                          { label: "With photos", value: "yes" },
                          { label: "Without photos", value: "no" },
                        ]}
                        selected={[hasPhotosFilter]}
                        onChange={handleHasPhotosChange}
                      />
                    ),
                    shortcut: true,
                  },
                ]}
                appliedFilters={[]}
                onQueryChange={handleSearchChange}
                onQueryClear={() => setSearchValue("")}
                onClearAll={handleClearFilters}
              />
              <div style={{ marginTop: "16px" }}>
                <Button onClick={handleFilterSubmit} primary>
                  Apply Filters
                </Button>
              </div>
            </div>
          </Card>
        </Layout.Section>
        
        <Layout.Section>
          <Card>
            <div style={{ padding: "20px" }}>
              <div style={{ marginBottom: "20px" }}>
                <p style={{ color: "#6d7175" }}>
                  Showing {productNotes.length} of {totalCount} notes
                </p>
              </div>
              
              {productNotes.length > 0 ? (
                <>
                  <DataTable
                    columnContentTypes={["text", "text", "numeric", "numeric", "text", "text", "text"]}
                    headings={[
                      "Product ID",
                      "Note",
                      "Photos",
                      "Edits",
                      "Last Updated",
                      "Updated By",
                      "Actions",
                    ]}
                    rows={rows}
                  />
                  
                  {totalPages > 1 && (
                    <div style={{ marginTop: "20px", display: "flex", justifyContent: "center" }}>
                      <Pagination
                        hasPrevious={currentPage > 1}
                        hasNext={currentPage < totalPages}
                        onPrevious={() => {
                          const formData = new FormData();
                          formData.append("search", searchValue);
                          formData.append("hasPhotos", hasPhotosFilter);
                          formData.append("page", String(currentPage - 1));
                          submit(formData, { method: "get" });
                        }}
                        onNext={() => {
                          const formData = new FormData();
                          formData.append("search", searchValue);
                          formData.append("hasPhotos", hasPhotosFilter);
                          formData.append("page", String(currentPage + 1));
                          submit(formData, { method: "get" });
                        }}
                      />
                    </div>
                  )}
                </>
              ) : (
                <p style={{ textAlign: "center", padding: "40px", color: "#6d7175" }}>
                  No product notes found matching your filters.
                </p>
              )}
            </div>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
// CodeRabbit review trigger - safe to remove

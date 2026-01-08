import { useState, useCallback } from "react";
import { json, redirect } from "@remix-run/node";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Card,
  BlockStack,
  Text,
  Button,
  DropZone,
  Thumbnail,
  Banner,
  InlineStack,
  Box,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { uploadFile, deleteFile } from "../utils/storage.server";
import { createAuditLog } from "../utils/audit.server";

export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { noteId } = params;

  const note = await prisma.productNote.findUnique({
    where: { id: noteId },
    include: { photos: true },
  });

  if (!note || note.shopDomain !== session.shop) {
    throw new Response("Not found", { status: 404 });
  }

  // Extract numeric product ID from GID (e.g., "gid://shopify/Product/123456" -> "123456")
  const productIdMatch = note.productId.match(/\/(\d+)$/);
  const numericProductId = productIdMatch ? productIdMatch[1] : null;

  return json({ note, shop: session.shop, numericProductId });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const { session } = await authenticate.admin(request);
  const { noteId } = params;

  const note = await prisma.productNote.findUnique({
    where: { id: noteId },
  });

  if (!note || note.shopDomain !== session.shop) {
    return json({ error: "Not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const action = formData.get("_action");

  if (action === "upload") {
    const photo = formData.get("photo") as File;

    if (!photo || photo.size === 0) {
      return json({ error: "No photo provided" }, { status: 400 });
    }

    try {
      // Upload photo and create thumbnail
      const { url, thumbnailUrl, filename } = await uploadFile(photo, session.shop, "product-notes");

      const photoRecord = await prisma.productNotePhoto.create({
        data: {
          noteId: noteId!,
          url,
          thumbnailUrl,
          filename,
          uploadedBy: session.email || session.id,
        },
      });

      await createAuditLog({
        shopDomain: session.shop,
        userId: session.id,
        userEmail: session.email,
        action: "CREATE",
        entityType: "PRODUCT_NOTE_PHOTO",
        entityId: photoRecord.id,
        newValue: photoRecord,
        productNoteId: noteId,
      });

      return json({ success: true, photo: photoRecord });
    } catch (error: any) {
      console.error("[Photo Upload] Error:", error);
      return json({ error: error.message || "Upload failed" }, { status: 500 });
    }
  }

  if (action === "delete") {
    const photoId = formData.get("photoId") as string;

    if (!photoId) {
      return json({ error: "Photo ID required" }, { status: 400 });
    }

    try {
      const photo = await prisma.productNotePhoto.findUnique({
        where: { id: photoId },
      });

      if (!photo || photo.noteId !== noteId) {
        return json({ error: "Photo not found" }, { status: 404 });
      }

      await deleteFile(photo.url);

      await prisma.productNotePhoto.delete({
        where: { id: photoId },
      });

      await createAuditLog({
        shopDomain: session.shop,
        userId: session.id,
        userEmail: session.email,
        action: "DELETE",
        entityType: "PRODUCT_NOTE_PHOTO",
        entityId: photoId,
        oldValue: photo,
        productNoteId: noteId,
      });

      return json({ success: true });
    } catch (error: any) {
      console.error("[Photo Delete] Error:", error);
      return json({ error: error.message || "Delete failed" }, { status: 500 });
    }
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function NotePhotosPage() {
  const { note, shop, numericProductId } = useLoaderData<typeof loader>();

  // Build the back URL to the product page in Shopify admin
  const backUrl = numericProductId
    ? `https://${shop}/admin/products/${numericProductId}`
    : "/app";
  const submit = useSubmit();
  const navigation = useNavigation();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);

  const isLoading = navigation.state === "submitting";

  const handleDropZoneDrop = useCallback(
    (_dropFiles: File[], acceptedFiles: File[]) => {
      setFiles((files) => [...files, ...acceptedFiles]);
      setError(null);
    },
    []
  );

  const handleUpload = async () => {
    if (files.length === 0) return;

    for (const file of files) {
      const formData = new FormData();
      formData.append("_action", "upload");
      formData.append("photo", file);
      submit(formData, { method: "post", encType: "multipart/form-data" });
    }

    setFiles([]);
  };

  const handleDelete = (photoId: string) => {
    const formData = new FormData();
    formData.append("_action", "delete");
    formData.append("photoId", photoId);
    submit(formData, { method: "post" });
  };

  const removeFile = (index: number) => {
    setFiles((files) => files.filter((_, i) => i !== index));
  };

  const fileUpload = !files.length && <DropZone.FileUpload />;

  const uploadedFiles = files.length > 0 && (
    <BlockStack gap="200">
      {files.map((file, index) => (
        <InlineStack key={index} gap="200" blockAlign="center">
          <Thumbnail
            size="small"
            alt={file.name}
            source={URL.createObjectURL(file)}
          />
          <Text as="span" variant="bodySm">
            {file.name}
          </Text>
          <Button variant="plain" tone="critical" onClick={() => removeFile(index)}>
            Remove
          </Button>
        </InlineStack>
      ))}
    </BlockStack>
  );

  return (
    <Page
      backAction={{ content: "Back to Product", url: backUrl }}
      title="Manage Note Photos"
      subtitle={`Note: "${note.content.substring(0, 50)}${note.content.length > 50 ? '...' : ''}"`}
    >
      <Layout>
        <Layout.Section>
          {error && (
            <Banner tone="critical" onDismiss={() => setError(null)}>
              <Text as="p">{error}</Text>
            </Banner>
          )}

          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Upload Photo
              </Text>

              {note.photos.length >= 1 ? (
                <Banner tone="info">
                  <Text as="p">Only 1 photo allowed per note. Delete the current photo to add a new one.</Text>
                </Banner>
              ) : (
                <>
                  <DropZone onDrop={handleDropZoneDrop} accept="image/*">
                    {uploadedFiles}
                    {fileUpload}
                  </DropZone>

                  {files.length > 0 && (
                    <Button
                      variant="primary"
                      onClick={handleUpload}
                      loading={isLoading}
                    >
                      Upload Photo
                    </Button>
                  )}
                </>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">
                Current Photo
              </Text>

              {note.photos.length === 0 ? (
                <Text as="p" tone="subdued">
                  No photo attached to this note yet.
                </Text>
              ) : (
                <InlineStack gap="400" wrap>
                  {note.photos.map((photo: any) => (
                    <Box key={photo.id}>
                      <BlockStack gap="200">
                        <img
                          src={photo.url.startsWith('/') ? photo.url : photo.url}
                          alt={photo.filename}
                          style={{
                            width: '150px',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e1e3e5',
                          }}
                        />
                        <Button
                          variant="plain"
                          tone="critical"
                          onClick={() => handleDelete(photo.id)}
                          loading={isLoading}
                        >
                          Delete
                        </Button>
                      </BlockStack>
                    </Box>
                  ))}
                </InlineStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

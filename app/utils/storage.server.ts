import { v4 as uuidv4 } from "uuid";

/**
 * Upload a file to Shopify's CDN using the Files API
 * This provides persistent storage without needing S3 or other external services
 */
export async function uploadFileToShopify(
  file: File,
  admin: any, // Shopify admin API client
  category: string
): Promise<{ url: string; filename: string }> {
  const extension = file.name.split(".").pop() || "jpg";
  const filename = `${category}-${uuidv4()}.${extension}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  // Step 1: Create a staged upload
  const stagedUploadResponse = await admin.graphql(`
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      input: [{
        filename: filename,
        mimeType: file.type || "image/jpeg",
        resource: "FILE",
        fileSize: buffer.length.toString(),
        httpMethod: "POST",
      }],
    },
  });

  const stagedUploadData = await stagedUploadResponse.json();

  if (stagedUploadData.data?.stagedUploadsCreate?.userErrors?.length > 0) {
    const errors = stagedUploadData.data.stagedUploadsCreate.userErrors;
    throw new Error(`Staged upload failed: ${errors.map((e: any) => e.message).join(", ")}`);
  }

  const stagedTarget = stagedUploadData.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!stagedTarget) {
    throw new Error("Failed to create staged upload");
  }

  // Step 2: Upload the file to the staged URL
  const formData = new FormData();

  // Add all parameters from Shopify
  for (const param of stagedTarget.parameters) {
    formData.append(param.name, param.value);
  }

  // Add the file last
  formData.append("file", new Blob([buffer], { type: file.type }), filename);

  const uploadResponse = await fetch(stagedTarget.url, {
    method: "POST",
    body: formData,
  });

  if (!uploadResponse.ok) {
    throw new Error(`File upload failed: ${uploadResponse.statusText}`);
  }

  // Step 3: Create the file in Shopify
  const fileCreateResponse = await admin.graphql(`
    mutation fileCreate($files: [FileCreateInput!]!) {
      fileCreate(files: $files) {
        files {
          id
          alt
          createdAt
          ... on MediaImage {
            image {
              url
            }
          }
          ... on GenericFile {
            url
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `, {
    variables: {
      files: [{
        originalSource: stagedTarget.resourceUrl,
        filename: filename,
        alt: `Product note photo - ${category}`,
      }],
    },
  });

  const fileCreateData = await fileCreateResponse.json();

  if (fileCreateData.data?.fileCreate?.userErrors?.length > 0) {
    const errors = fileCreateData.data.fileCreate.userErrors;
    throw new Error(`File create failed: ${errors.map((e: any) => e.message).join(", ")}`);
  }

  const createdFile = fileCreateData.data?.fileCreate?.files?.[0];
  if (!createdFile) {
    throw new Error("Failed to create file in Shopify");
  }

  // Get the URL from either MediaImage or GenericFile
  const finalUrl = createdFile.image?.url || createdFile.url || stagedTarget.resourceUrl;

  return { url: finalUrl, filename };
}

/**
 * Delete a file from Shopify's CDN
 * Note: Shopify doesn't easily support deleting files by URL,
 * so we just return success (the file will remain but be orphaned)
 */
export async function deleteFileFromShopify(url: string): Promise<void> {
  // Shopify Files API requires the file ID to delete
  // Since we only store the URL, we can't easily delete
  // In production, you might want to store the file ID as well
  console.log("[Storage] File deletion requested for:", url);
}

// Legacy functions for backwards compatibility
export async function uploadFile(
  file: File,
  shopDomain: string,
  category: string
): Promise<{ url: string; filename: string }> {
  // This function is now deprecated - use uploadFileToShopify instead
  // Keeping for backwards compatibility during transition
  throw new Error("uploadFile is deprecated. Use uploadFileToShopify with admin client instead.");
}

export async function deleteFile(url: string): Promise<void> {
  await deleteFileFromShopify(url);
}

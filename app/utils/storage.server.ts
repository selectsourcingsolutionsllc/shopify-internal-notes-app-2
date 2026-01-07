import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

// Railway Volume mount path - set via environment variable or default
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL || "https://shopify-internal-notes-app-production.up.railway.app";

/**
 * Upload a file to Railway Volume (persistent storage)
 */
export async function uploadFile(
  file: File,
  shopDomain: string,
  category: string
): Promise<{ url: string; filename: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop() || "jpg";
  const filename = `${uuidv4()}.${extension}`;

  // Create path: /data/uploads/{shop}/{category}/{filename}
  const relativePath = `${shopDomain}/${category}`;
  const fullDir = join(UPLOAD_DIR, relativePath);
  const fullPath = join(fullDir, filename);

  // Create directory if it doesn't exist
  await mkdir(fullDir, { recursive: true });

  // Write file
  await writeFile(fullPath, buffer);

  // Return URL that will be served by Express
  const url = `${PUBLIC_URL}/uploads/${relativePath}/${filename}`;

  console.log("[Storage] File saved to:", fullPath);
  console.log("[Storage] Public URL:", url);

  return { url, filename };
}

/**
 * Delete a file from Railway Volume
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    // Extract path from URL
    const urlPath = url.split("/uploads/")[1];
    if (!urlPath) {
      console.log("[Storage] Could not parse URL for deletion:", url);
      return;
    }

    const fullPath = join(UPLOAD_DIR, urlPath);
    await unlink(fullPath);
    console.log("[Storage] File deleted:", fullPath);
  } catch (error) {
    console.error("[Storage] Error deleting file:", error);
  }
}

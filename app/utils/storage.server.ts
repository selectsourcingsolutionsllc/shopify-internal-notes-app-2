import { writeFile, mkdir, unlink } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// Railway Volume mount path - set via environment variable or default
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL || "https://shopify-internal-notes-app-production.up.railway.app";

// Thumbnail size in pixels
const THUMBNAIL_SIZE = 50;

/**
 * Upload a file to Railway Volume (persistent storage)
 * Also creates a thumbnail version for display in extensions
 */
export async function uploadFile(
  file: File,
  shopDomain: string,
  category: string
): Promise<{ url: string; thumbnailUrl: string; filename: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const baseFilename = uuidv4();
  const filename = `${baseFilename}.${extension}`;
  const thumbnailFilename = `${baseFilename}_thumb.${extension}`;

  // Create path: /data/uploads/{shop}/{category}/{filename}
  const relativePath = `${shopDomain}/${category}`;
  const fullDir = join(UPLOAD_DIR, relativePath);
  const fullPath = join(fullDir, filename);
  const thumbnailPath = join(fullDir, thumbnailFilename);

  // Create directory if it doesn't exist
  await mkdir(fullDir, { recursive: true });

  // Write original file
  await writeFile(fullPath, buffer);

  // Create and save thumbnail
  try {
    const thumbnailBuffer = await sharp(buffer)
      .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
        fit: "cover",
        position: "center",
      })
      .toBuffer();
    await writeFile(thumbnailPath, thumbnailBuffer);
    console.log("[Storage] Thumbnail created:", thumbnailPath);
  } catch (error) {
    console.error("[Storage] Failed to create thumbnail:", error);
    // If thumbnail creation fails, use the original as fallback
  }

  // Return URLs that will be served by Express
  const url = `${PUBLIC_URL}/uploads/${relativePath}/${filename}`;
  const thumbnailUrl = `${PUBLIC_URL}/uploads/${relativePath}/${thumbnailFilename}`;

  console.log("[Storage] File saved to:", fullPath);
  console.log("[Storage] Public URL:", url);
  console.log("[Storage] Thumbnail URL:", thumbnailUrl);

  return { url, thumbnailUrl, filename };
}

/**
 * Delete a file and its thumbnail from Railway Volume
 */
export async function deleteFile(url: string, thumbnailUrl?: string): Promise<void> {
  // Delete original file
  try {
    const urlPath = url.split("/uploads/")[1];
    if (urlPath) {
      const fullPath = join(UPLOAD_DIR, urlPath);
      await unlink(fullPath);
      console.log("[Storage] File deleted:", fullPath);
    }
  } catch (error) {
    console.error("[Storage] Error deleting file:", error);
  }

  // Delete thumbnail if provided
  if (thumbnailUrl) {
    try {
      const thumbPath = thumbnailUrl.split("/uploads/")[1];
      if (thumbPath) {
        const fullThumbPath = join(UPLOAD_DIR, thumbPath);
        await unlink(fullThumbPath);
        console.log("[Storage] Thumbnail deleted:", fullThumbPath);
      }
    } catch (error) {
      console.error("[Storage] Error deleting thumbnail:", error);
    }
  }
}

// CodeRabbit review trigger - safe to remove

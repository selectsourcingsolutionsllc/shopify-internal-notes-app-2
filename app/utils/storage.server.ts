import { writeFile, mkdir, unlink } from "fs/promises";
import { join, normalize, resolve } from "path";
import { v4 as uuidv4 } from "uuid";
import sharp from "sharp";

// Railway Volume mount path - set via environment variable or default
const UPLOAD_DIR = process.env.UPLOAD_DIR || "/data/uploads";
const PUBLIC_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : process.env.PUBLIC_URL || "https://shopify-internal-notes-app-production.up.railway.app";

// Thumbnail size in pixels
const THUMBNAIL_SIZE = 50;

// Security: File upload limits
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max file size
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "webp"];
const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
];

/**
 * Validate file for upload
 * @throws Error if file is invalid
 */
function validateFile(file: File): void {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`);
  }

  // Check file extension
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_EXTENSIONS.join(", ")}`);
  }

  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error(`Invalid file type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`);
  }
}

/**
 * Sanitize path to prevent path traversal attacks
 * Ensures the final path is within UPLOAD_DIR
 */
function sanitizePath(basePath: string, relativePath: string): string {
  // Normalize and resolve the full path
  const fullPath = resolve(basePath, relativePath);
  const normalizedBase = resolve(basePath);

  // Ensure the path is within the base directory
  if (!fullPath.startsWith(normalizedBase)) {
    throw new Error("Invalid path: path traversal detected");
  }

  return fullPath;
}

/**
 * Upload a file to Railway Volume (persistent storage)
 * Also creates a thumbnail version for display in extensions
 */
export async function uploadFile(
  file: File,
  shopDomain: string,
  category: string
): Promise<{ url: string; thumbnailUrl: string; filename: string }> {
  // Validate file before processing
  validateFile(file);

  // Sanitize shop domain and category to prevent path traversal
  const safeShopDomain = shopDomain.replace(/[^a-zA-Z0-9.-]/g, "_");
  const safeCategory = category.replace(/[^a-zA-Z0-9-]/g, "_");

  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";

  // Double-check extension is allowed (belt and suspenders)
  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    throw new Error("Invalid file extension");
  }

  const baseFilename = uuidv4();
  const filename = `${baseFilename}.${extension}`;
  const thumbnailFilename = `${baseFilename}_thumb.${extension}`;

  // Create path: /data/uploads/{shop}/{category}/{filename}
  const relativePath = `${safeShopDomain}/${safeCategory}`;

  // Use sanitizePath to prevent path traversal
  const fullDir = sanitizePath(UPLOAD_DIR, relativePath);
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
 * Includes path traversal protection
 */
export async function deleteFile(url: string, thumbnailUrl?: string): Promise<void> {
  // Delete original file
  try {
    const urlPath = url.split("/uploads/")[1];
    if (urlPath) {
      // Sanitize path to prevent path traversal attacks
      const fullPath = sanitizePath(UPLOAD_DIR, urlPath);
      await unlink(fullPath);
      console.log("[Storage] File deleted:", fullPath);
    }
  } catch (error: any) {
    // Don't log "path traversal detected" errors as they're expected for malicious requests
    if (error.message !== "Invalid path: path traversal detected") {
      console.error("[Storage] Error deleting file:", error);
    } else {
      console.warn("[Storage] Path traversal attempt blocked:", url);
    }
  }

  // Delete thumbnail if provided
  if (thumbnailUrl) {
    try {
      const thumbPath = thumbnailUrl.split("/uploads/")[1];
      if (thumbPath) {
        // Sanitize path to prevent path traversal attacks
        const fullThumbPath = sanitizePath(UPLOAD_DIR, thumbPath);
        await unlink(fullThumbPath);
        console.log("[Storage] Thumbnail deleted:", fullThumbPath);
      }
    } catch (error: any) {
      if (error.message !== "Invalid path: path traversal detected") {
        console.error("[Storage] Error deleting thumbnail:", error);
      } else {
        console.warn("[Storage] Path traversal attempt blocked:", thumbnailUrl);
      }
    }
  }
}

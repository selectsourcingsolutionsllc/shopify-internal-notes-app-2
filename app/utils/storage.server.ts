import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { v4 as uuidv4 } from "uuid";

let s3Client: S3Client | null = null;

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
}

export async function uploadFile(
  file: File,
  shopDomain: string,
  category: string
): Promise<{ url: string; filename: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.name.split(".").pop() || "jpg";
  const filename = `${uuidv4()}.${extension}`;
  const key = `${shopDomain}/${category}/${filename}`;

  if (s3Client && process.env.S3_BUCKET_NAME) {
    // Production: Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    });

    await s3Client.send(command);
    
    const url = `https://${process.env.S3_BUCKET_NAME}.s3.amazonaws.com/${key}`;
    return { url, filename };
  } else {
    // Development: Save to local filesystem
    const localPath = join(process.cwd(), "public", "uploads", shopDomain, category);
    const filePath = join(localPath, filename);
    
    // Create directory if it doesn't exist
    await mkdir(localPath, { recursive: true });
    
    // Write file
    await writeFile(filePath, buffer);
    
    const url = `/uploads/${shopDomain}/${category}/${filename}`;
    return { url, filename };
  }
}

export async function deleteFile(url: string): Promise<void> {
  if (s3Client && process.env.S3_BUCKET_NAME && url.includes("s3.amazonaws.com")) {
    // Extract key from S3 URL
    const key = url.split(".com/")[1];
    
    // Delete from S3
    // Implementation would go here
  } else {
    // Delete from local filesystem
    // Implementation would go here
  }
}
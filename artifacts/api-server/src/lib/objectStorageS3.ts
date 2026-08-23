import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { Upload } from "@aws-sdk/lib-storage";
import { Readable } from "stream";
import { randomUUID } from "crypto";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type UploadTarget,
} from "./storageTypes";

const UPLOAD_PREFIX = "uploads/";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Set your S3-compatible object storage settings ` +
        `(see .env.example).`,
    );
  }
  return value;
}

function normalizePrefix(prefix: string): string {
  const trimmed = prefix.replace(/^\/+/, "");
  if (!trimmed) return "";
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
}

/**
 * S3-compatible object storage backend (AWS S3, Cloudflare R2, Backblaze B2,
 * Oracle Cloud Object Storage, MinIO, etc.).
 *
 * Many S3-compatible providers (including Oracle Object Storage) do not
 * support CORS, so a browser cannot PUT directly to a presigned URL. Instead,
 * getUploadURL() returns a same-origin relay URL on this API server; the
 * relay route (PUT /api/storage/uploads/direct/:id) streams the request body
 * here via putPrivateObject(). Downloads are streamed through this server
 * too, so the store never needs to be public.
 */
export class S3StorageBackend implements StorageBackend {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicPrefix: string;

  constructor() {
    this.bucket = requireEnv("S3_BUCKET");
    const accessKeyId = requireEnv("S3_ACCESS_KEY_ID");
    const secretAccessKey = requireEnv("S3_SECRET_ACCESS_KEY");
    this.publicPrefix = normalizePrefix(
      process.env.S3_PUBLIC_PREFIX ?? "public/",
    );

    const forcePathStyle =
      (process.env.S3_FORCE_PATH_STYLE ?? "true").toLowerCase() !== "false";

    this.client = new S3Client({
      region: process.env.S3_REGION || "us-east-1",
      endpoint: process.env.S3_ENDPOINT || undefined,
      forcePathStyle,
      credentials: { accessKeyId, secretAccessKey },
    });
  }

  async getUploadURL({
    relayBaseUrl,
  }: {
    relayBaseUrl: string;
  }): Promise<UploadTarget> {
    const objectId = randomUUID();
    return {
      uploadURL: `${relayBaseUrl}/${objectId}`,
      objectPath: `/objects/uploads/${objectId}`,
    };
  }

  async putPrivateObject(
    objectId: string,
    body: Readable,
    contentType: string,
  ): Promise<void> {
    const upload = new Upload({
      client: this.client,
      params: {
        Bucket: this.bucket,
        Key: `${UPLOAD_PREFIX}${objectId}`,
        Body: body,
        ContentType: contentType,
      },
    });
    await upload.done();
  }

  async getPublicObjectResponse(
    filePath: string,
    cacheTtlSec: number = 3600,
  ): Promise<Response | null> {
    try {
      return await this.fetchObject(
        `${this.publicPrefix}${filePath}`,
        cacheTtlSec,
        true,
      );
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        return null;
      }
      throw error;
    }
  }

  async getPrivateObjectResponse(
    objectPath: string,
    cacheTtlSec: number = 3600,
  ): Promise<Response> {
    if (!objectPath.startsWith("/objects/")) {
      throw new ObjectNotFoundError();
    }
    const key = objectPath.slice("/objects/".length);
    // Confine private reads to the uploads/ prefix and reject any path-traversal
    // segments.
    if (!key.startsWith(UPLOAD_PREFIX) || key.split("/").includes("..")) {
      throw new ObjectNotFoundError();
    }
    return this.fetchObject(key, cacheTtlSec, false);
  }

  private async fetchObject(
    key: string,
    cacheTtlSec: number,
    isPublic: boolean,
  ): Promise<Response> {
    let output;
    try {
      output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
    } catch (error) {
      if (isNotFoundError(error)) {
        throw new ObjectNotFoundError();
      }
      throw error;
    }

    if (!output.Body) {
      throw new ObjectNotFoundError();
    }

    const nodeStream = output.Body as Readable;
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": output.ContentType || "application/octet-stream",
      "Cache-Control": `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    };
    if (output.ContentLength != null) {
      headers["Content-Length"] = String(output.ContentLength);
    }

    return new Response(webStream, { headers });
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as {
    name?: string;
    Code?: string;
    $metadata?: { httpStatusCode?: number };
  };
  return (
    e.name === "NoSuchKey" ||
    e.name === "NotFound" ||
    e.Code === "NoSuchKey" ||
    e.$metadata?.httpStatusCode === 404
  );
}

import {
  ObjectNotFoundError,
  type StorageBackend,
  type UploadTarget,
} from "./storageTypes";

const UPLOAD_PREFIX = "uploads/";
const PUBLIC_PREFIX = "public/";

/**
 * R2 object storage backend, using the `DOCS_BUCKET` bucket binding
 * (`c.env.DOCS_BUCKET`) declared in wrangler.jsonc - no S3 SDK, credentials,
 * region, or endpoint configuration needed, since a binding gives this
 * Worker direct, already-authenticated access to the bucket.
 *
 * A binding can only be reached from inside the Worker that holds it, not
 * directly from a browser, so uploads still go through the same-origin
 * relay pattern the old S3-compatible backend used (POST
 * /storage/uploads/request-url to get a relay URL, then PUT the file to
 * it - see routes/storage.ts): the browser PUTs to this Worker, and this
 * Worker streams the body into R2 via `bucket.put()`. Downloads are
 * streamed back out through this Worker the same way, so the bucket itself
 * never needs to be public.
 */
export class R2StorageBackend implements StorageBackend {
  constructor(private readonly bucket: R2Bucket) {}

  async getUploadURL({
    relayBaseUrl,
  }: {
    relayBaseUrl: string;
  }): Promise<UploadTarget> {
    const objectId = crypto.randomUUID();
    return {
      uploadURL: `${relayBaseUrl}/${objectId}`,
      objectPath: `/objects/uploads/${objectId}`,
    };
  }

  async putPrivateObject(
    objectId: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | null,
    contentType: string,
  ): Promise<void> {
    await this.bucket.put(`${UPLOAD_PREFIX}${objectId}`, body, {
      httpMetadata: { contentType },
    });
  }

  async getPublicObjectResponse(
    filePath: string,
    cacheTtlSec: number = 3600,
  ): Promise<Response | null> {
    try {
      return await this.fetchObject(
        `${PUBLIC_PREFIX}${filePath}`,
        cacheTtlSec,
        true,
      );
    } catch (error) {
      if (error instanceof ObjectNotFoundError) return null;
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
    // Confine private reads to the uploads/ prefix and reject any
    // path-traversal segments.
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
    const object = await this.bucket.get(key);
    if (!object) throw new ObjectNotFoundError();

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set(
      "Cache-Control",
      `${isPublic ? "public" : "private"}, max-age=${cacheTtlSec}`,
    );
    headers.set("ETag", object.httpEtag);
    if (!headers.has("Content-Type")) {
      headers.set("Content-Type", "application/octet-stream");
    }

    return new Response(object.body, { headers });
  }
}

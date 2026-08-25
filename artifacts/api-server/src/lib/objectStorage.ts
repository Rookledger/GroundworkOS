import { R2StorageBackend } from "./objectStorageR2";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type UploadTarget,
} from "./storageTypes";

export { ObjectNotFoundError };
export type { StorageBackend, UploadTarget };

/**
 * Facade over the storage backend. Route handlers use this class and stay
 * agnostic to what backs it; today that's always R2 (`c.env.DOCS_BUCKET`),
 * but keeping the facade means a future second backend (or a test double)
 * doesn't require touching every route.
 */
export class ObjectStorageService implements StorageBackend {
  private readonly backend: StorageBackend;

  constructor(bucket: R2Bucket) {
    this.backend = new R2StorageBackend(bucket);
  }

  getUploadURL(opts: { relayBaseUrl: string }): Promise<UploadTarget> {
    return this.backend.getUploadURL(opts);
  }

  putPrivateObject(
    objectId: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | null,
    contentType: string,
  ): Promise<void> {
    return this.backend.putPrivateObject(objectId, body, contentType);
  }

  getPublicObjectResponse(
    filePath: string,
    cacheTtlSec?: number,
  ): Promise<Response | null> {
    return this.backend.getPublicObjectResponse(filePath, cacheTtlSec);
  }

  getPrivateObjectResponse(
    objectPath: string,
    cacheTtlSec?: number,
  ): Promise<Response> {
    return this.backend.getPrivateObjectResponse(objectPath, cacheTtlSec);
  }
}

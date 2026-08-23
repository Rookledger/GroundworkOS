import type { Readable } from "stream";
import { S3StorageBackend } from "./objectStorageS3";
import {
  ObjectNotFoundError,
  type StorageBackend,
  type UploadTarget,
} from "./storageTypes";

export { ObjectNotFoundError };
export type { StorageBackend, UploadTarget };

/**
 * Facade over the S3-compatible StorageBackend (AWS S3, Cloudflare R2,
 * Backblaze B2, Oracle Cloud Object Storage, MinIO, etc.). Route handlers use
 * this class and are agnostic to which S3-compatible provider is configured.
 */
export class ObjectStorageService implements StorageBackend {
  private readonly backend: StorageBackend;

  constructor() {
    this.backend = new S3StorageBackend();
  }

  getUploadURL(opts: { relayBaseUrl: string }): Promise<UploadTarget> {
    return this.backend.getUploadURL(opts);
  }

  putPrivateObject(
    objectId: string,
    body: Readable,
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

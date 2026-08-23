import type { Readable } from "stream";

/** Thrown when a requested object does not exist in the backing store. */
export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export interface UploadTarget {
  /**
   * URL the browser PUTs the file to. This is a same-origin relay URL on this
   * API server, since most S3-compatible providers (including Oracle Object
   * Storage) don't support CORS for direct browser uploads.
   */
  uploadURL: string;
  /** App-internal path stored in the DB, e.g. "/objects/uploads/<uuid>". */
  objectPath: string;
}

/**
 * Object storage contract implemented by the S3-compatible backend (see
 * objectStorage.ts).
 */
export interface StorageBackend {
  /**
   * Create an upload target for a new private object.
   * @param opts.relayBaseUrl Base URL for the same-origin upload relay
   * ("/api/storage/uploads/direct"). Backends that presign upload URLs ignore it.
   */
  getUploadURL(opts: { relayBaseUrl: string }): Promise<UploadTarget>;

  /**
   * Stream a raw request body into a private object. Used only by backends that
   * rely on the same-origin upload relay (s3). Presigning backends throw.
   */
  putPrivateObject(
    objectId: string,
    body: Readable,
    contentType: string,
  ): Promise<void>;

  /** Fetch a public object as a web Response, or null if it does not exist. */
  getPublicObjectResponse(
    filePath: string,
    cacheTtlSec?: number,
  ): Promise<Response | null>;

  /**
   * Fetch a private object (path form "/objects/...") as a web Response.
   * Throws ObjectNotFoundError if it does not exist.
   */
  getPrivateObjectResponse(
    objectPath: string,
    cacheTtlSec?: number,
  ): Promise<Response>;
}

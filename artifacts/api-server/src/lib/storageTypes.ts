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
   * URL the browser PUTs the file to. This is a same-origin relay URL on
   * this Worker: R2 bucket *bindings* (unlike a presigned S3 URL) can only
   * be reached from inside the Worker that holds the binding, not directly
   * from a browser, so the relay pattern carries over unchanged from the
   * old S3-compatible backend.
   */
  uploadURL: string;
  /** App-internal path stored in the DB, e.g. "/objects/uploads/<uuid>". */
  objectPath: string;
}

/**
 * Object storage contract implemented by the R2 backend (see
 * objectStorage.ts). `body`/return types use the platform `ReadableStream`
 * and `Response` (Fetch API) instead of Node's `stream.Readable` - there is
 * no Node stream implementation on a V8 isolate, and R2's bucket binding
 * already speaks web streams natively.
 */
export interface StorageBackend {
  /**
   * Create an upload target for a new private object.
   * @param opts.relayBaseUrl Base URL for the same-origin upload relay
   * ("/api/storage/uploads/direct").
   */
  getUploadURL(opts: { relayBaseUrl: string }): Promise<UploadTarget>;

  /** Stream a raw request body into a private object via the upload relay. */
  putPrivateObject(
    objectId: string,
    body: ReadableStream<Uint8Array> | ArrayBuffer | null,
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

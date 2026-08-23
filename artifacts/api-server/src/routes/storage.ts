import {
  Router,
  type IRouter,
  type Request,
  type Response as ExpressResponse,
} from "express";
import { Readable } from "stream";
import { z } from "zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { requireRole } from "../lib/auth.js";

const RequestUploadUrlBody = z.object({
  name: z.string(),
  size: z.number(),
  contentType: z.string(),
});

const RequestUploadUrlResponse = z.object({
  uploadURL: z.string(),
  objectPath: z.string(),
  metadata: z.object({
    name: z.string(),
    size: z.number(),
    contentType: z.string(),
  }),
});

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

/** Pipe a web Response (from the storage service) to the Express response. */
function sendWebResponse(response: Response, res: ExpressResponse): void {
  res.status(response.status);
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (response.body) {
    const nodeStream = Readable.fromWeb(
      response.body as ReadableStream<Uint8Array>,
    );
    nodeStream.pipe(res);
  } else {
    res.end();
  }
}

/**
 * POST /storage/uploads/request-url
 *
 * Request an upload target for a file.
 * The client sends JSON metadata (name, size, contentType) — NOT the file — then
 * PUTs the file to the returned uploadURL, which is a same-origin relay URL on
 * this server. The client contract stays identical regardless of which
 * S3-compatible provider is configured.
 */
router.post(
  "/storage/uploads/request-url",
  requireRole("manager"),
  async (req: Request, res: ExpressResponse) => {
    const parsed = RequestUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Missing or invalid required fields" });
      return;
    }

    try {
      const { name, size, contentType } = parsed.data;

      const relayBaseUrl = `${req.baseUrl}/storage/uploads/direct`;
      const { uploadURL, objectPath } = await objectStorageService.getUploadURL(
        { relayBaseUrl },
      );

      res.json(
        RequestUploadUrlResponse.parse({
          uploadURL,
          objectPath,
          metadata: { name, size, contentType },
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Error generating upload URL");
      res.status(500).json({ error: "Failed to generate upload URL" });
    }
  },
);

/**
 * PUT /storage/uploads/direct/:id
 *
 * Same-origin upload relay for S3-compatible backends. Oracle Object Storage has
 * no CORS support, so a browser cannot PUT to the store directly; instead it PUTs
 * here and we stream the raw request body into object storage.
 *
 * The raw body must NOT be consumed by a body parser — app.ts skips the JSON /
 * urlencoded parsers for this path. Manager-gated to match the Documents feature.
 * The :id is validated as a UUID (it comes from our own getUploadURL) to keep the
 * object key inside the uploads/ namespace.
 */
router.put(
  "/storage/uploads/direct/:id",
  requireRole("manager"),
  async (req: Request, res: ExpressResponse) => {
    const rawId = req.params.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;
    if (!UUID_RE.test(id)) {
      res.status(400).json({ error: "Invalid upload id" });
      return;
    }

    const contentType =
      (req.headers["content-type"] as string) || "application/octet-stream";
    try {
      await objectStorageService.putPrivateObject(id, req, contentType);
      res.status(200).json({ ok: true });
    } catch (error) {
      req.log.error({ err: error }, "Error uploading object");
      res.status(500).json({ error: "Failed to upload object" });
    }
  },
);

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets. These are unconditionally public — no authentication or
 * ACL checks. IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get(
  "/storage/public-objects/*filePath",
  async (req: Request, res: ExpressResponse) => {
    try {
      const raw = req.params.filePath;
      const filePath = Array.isArray(raw) ? raw.join("/") : raw;
      const response =
        await objectStorageService.getPublicObjectResponse(filePath);
      if (!response) {
        res.status(404).json({ error: "File not found" });
        return;
      }

      sendWebResponse(response, res);
    } catch (error) {
      req.log.error({ err: error }, "Error serving public object");
      res.status(500).json({ error: "Failed to serve public object" });
    }
  },
);

/**
 * GET /storage/objects/*
 *
 * Serve private object entities.
 *
 * All objects currently uploaded through this app (RAMS, insurance certs,
 * certifications, permits, plant compliance records) are company documents
 * managed exclusively through the Documents feature, which is manager-gated
 * end to end (nav item, list/create/update API routes). Uploads never set a
 * per-object ACL policy (see lib/objectAcl.ts), so the generic owner/group
 * ACL check would reject every request; gating on role here matches the
 * access level already enforced for the Documents feature itself.
 * If a future use case needs per-object ownership or finer-grained sharing,
 * revisit this with the ACL policy machinery in lib/objectAcl.ts instead of
 * loosening this role gate.
 */
router.get(
  "/storage/objects/*path",
  requireRole("manager"),
  async (req: Request, res: ExpressResponse) => {
    try {
      const raw = req.params.path;
      const wildcardPath = Array.isArray(raw) ? raw.join("/") : raw;
      const objectPath = `/objects/${wildcardPath}`;
      const response =
        await objectStorageService.getPrivateObjectResponse(objectPath);

      sendWebResponse(response, res);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        req.log.warn({ err: error }, "Object not found");
        res.status(404).json({ error: "Object not found" });
        return;
      }
      req.log.error({ err: error }, "Error serving object");
      res.status(500).json({ error: "Failed to serve object" });
    }
  },
);

export default router;

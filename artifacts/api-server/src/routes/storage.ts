import { Hono } from "hono";
import { z } from "zod";
import {
  ObjectStorageService,
  ObjectNotFoundError,
} from "../lib/objectStorage";
import { requireRole } from "../lib/auth.js";
import type { AppEnv } from "../types";

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

const router = new Hono<AppEnv>();

/** Convert a web Response (from the storage service) into a Hono response. */
function sendWebResponse(c: any, response: Response) {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });
  return c.body(response.body, response.status, headers);
}

/**
 * POST /storage/uploads/request-url
 *
 * Request an upload target for a file.
 * The client sends JSON metadata (name, size, contentType) — NOT the file — then
 * PUTs the file to the returned uploadURL, which is a same-origin relay URL on
 * this server. The client contract stays identical regardless of which
 * storage backend is configured behind it.
 */
router.post("/storage/uploads/request-url", requireRole("manager"), async (c) => {
  const parsed = RequestUploadUrlBody.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "Missing or invalid required fields" }, 400);
  }

  try {
    const { name, size, contentType } = parsed.data;
    const objectStorageService = new ObjectStorageService(c.env.DOCS_BUCKET);

    const relayBaseUrl = c.req.path.replace(
      /\/storage\/uploads\/request-url$/,
      "/storage/uploads/direct",
    );
    const { uploadURL, objectPath } = await objectStorageService.getUploadURL({
      relayBaseUrl,
    });

    return c.json(
      RequestUploadUrlResponse.parse({
        uploadURL,
        objectPath,
        metadata: { name, size, contentType },
      }),
    );
  } catch (error) {
    c.get("logger").error({ err: error }, "Error generating upload URL");
    return c.json({ error: "Failed to generate upload URL" }, 500);
  }
});

/**
 * PUT /storage/uploads/direct/:id
 *
 * Same-origin upload relay: the browser PUTs the raw file body here (rather
 * than directly to R2, which isn't reachable from a browser — bucket
 * bindings are only visible inside the Worker), and this streams the raw
 * request body straight into the bucket. Manager-gated to match the
 * Documents feature. The :id is validated as a UUID (it comes from our own
 * getUploadURL) to keep the object key inside the uploads/ namespace.
 */
router.put("/storage/uploads/direct/:id", requireRole("manager"), async (c) => {
  const id = c.req.param("id");
  if (!UUID_RE.test(id)) {
    return c.json({ error: "Invalid upload id" }, 400);
  }

  const contentType = c.req.header("content-type") || "application/octet-stream";
  try {
    const objectStorageService = new ObjectStorageService(c.env.DOCS_BUCKET);
    await objectStorageService.putPrivateObject(id, c.req.raw.body, contentType);
    return c.json({ ok: true }, 200);
  } catch (error) {
    c.get("logger").error({ err: error }, "Error uploading object");
    return c.json({ error: "Failed to upload object" }, 500);
  }
});

/**
 * GET /storage/public-objects/*
 *
 * Serve public assets. These are unconditionally public — no authentication or
 * ACL checks. IMPORTANT: Always provide this endpoint when object storage is set up.
 */
router.get("/storage/public-objects/:filePath{.+}", async (c) => {
  try {
    const filePath = c.req.param("filePath");
    const objectStorageService = new ObjectStorageService(c.env.DOCS_BUCKET);
    const response = await objectStorageService.getPublicObjectResponse(filePath);
    if (!response) {
      return c.json({ error: "File not found" }, 404);
    }
    return sendWebResponse(c, response);
  } catch (error) {
    c.get("logger").error({ err: error }, "Error serving public object");
    return c.json({ error: "Failed to serve public object" }, 500);
  }
});

/**
 * GET /storage/objects/*
 *
 * Serve private object entities.
 *
 * All objects currently uploaded through this app (RAMS, insurance certs,
 * certifications, permits, plant compliance records) are company documents
 * managed exclusively through the Documents feature, which is manager-gated
 * end to end (nav item, list/create/update API routes). Uploads never set a
 * per-object ACL policy, so a generic owner/group ACL check would reject
 * every request; gating on role here matches the access level already
 * enforced for the Documents feature itself.
 */
router.get(
  "/storage/objects/:wildcardPath{.+}",
  requireRole("manager"),
  async (c) => {
    try {
      const wildcardPath = c.req.param("wildcardPath");
      const objectPath = `/objects/${wildcardPath}`;
      const objectStorageService = new ObjectStorageService(c.env.DOCS_BUCKET);
      const response = await objectStorageService.getPrivateObjectResponse(objectPath);
      return sendWebResponse(c, response);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        c.get("logger").warn({ err: error }, "Object not found");
        return c.json({ error: "Object not found" }, 404);
      }
      c.get("logger").error({ err: error }, "Error serving object");
      return c.json({ error: "Failed to serve object" }, 500);
    }
  },
);

export default router;

import { DocumentValidationError, extractDocument, MAX_FILE_BYTES } from "@/lib/document-extractor";
import { MAX_FILE_MEGABYTES } from "@/lib/document-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
const responseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in before uploading a document." }, { status: 401, headers: responseHeaders });
    const rateLimitResponse = await enforceRateLimit(request, "document", userId);
    if (rateLimitResponse) return rateLimitResponse;

    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return Response.json({ error: "Expected a document upload." }, { status: 415, headers: responseHeaders });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_FILE_BYTES + 64 * 1024) {
      return Response.json({ error: `The upload is larger than the ${MAX_FILE_MEGABYTES} MB deployment-safe limit.` }, { status: 413, headers: responseHeaders });
    }
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a document to upload." }, { status: 400, headers: responseHeaders });
    return Response.json({ document: await extractDocument(file) }, { headers: responseHeaders });
  } catch (error) {
    const message = error instanceof DocumentValidationError ? error.message : "The document could not be processed.";
    return Response.json({ error: message }, { status: error instanceof DocumentValidationError ? 400 : 500, headers: responseHeaders });
  }
}

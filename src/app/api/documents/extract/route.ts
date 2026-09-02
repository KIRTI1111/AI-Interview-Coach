import { DocumentValidationError, extractDocument, MAX_FILE_BYTES } from "@/lib/document-extractor";
import { MAX_FILE_MEGABYTES } from "@/lib/document-limits";
import { enforceRateLimit } from "@/lib/rate-limit";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";
const responseHeaders = { "Cache-Control": "no-store, max-age=0", "X-Content-Type-Options": "nosniff" };

export async function POST(request: Request) {
  let stage = "authentication";
  try {
    const { userId } = await auth();
    if (!userId) return Response.json({ error: "Sign in before uploading a document." }, { status: 401, headers: responseHeaders });
    stage = "rate-limiting";
    const rateLimitResponse = await enforceRateLimit(request, "document", userId);
    if (rateLimitResponse) return rateLimitResponse;

    stage = "request-validation";
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().startsWith("multipart/form-data")) {
      return Response.json({ error: "Expected a document upload." }, { status: 415, headers: responseHeaders });
    }
    const declaredLength = Number(request.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_FILE_BYTES + 64 * 1024) {
      return Response.json({ error: `The upload is larger than the ${MAX_FILE_MEGABYTES} MB deployment-safe limit.` }, { status: 413, headers: responseHeaders });
    }
    stage = "multipart-parsing";
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "Choose a document to upload." }, { status: 400, headers: responseHeaders });
    stage = "document-extraction";
    return Response.json({ document: await extractDocument(file) }, { headers: responseHeaders });
  } catch (error) {
    if (error instanceof DocumentValidationError) {
      return Response.json({ error: error.message }, { status: 400, headers: responseHeaders });
    }
    const diagnostic = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown server error";
    console.error(`[document-upload:${stage}] ${diagnostic}`);
    const descriptions: Record<string, string> = {
      authentication: "authentication verification",
      "rate-limiting": "upload protection",
      "request-validation": "request validation",
      "multipart-parsing": "reading the uploaded file",
      "document-extraction": "document extraction",
    };
    return Response.json(
      { error: `The server failed during ${descriptions[stage] ?? "document processing"}. Please try again.`, diagnosticStage: stage },
      { status: 500, headers: responseHeaders },
    );
  }
}

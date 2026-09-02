import { describe, expect, it } from "vitest";
import { DocumentValidationError, extractDocument, MAX_FILE_BYTES } from "@/lib/document-extractor";

describe("secure document extraction", () => {
  it("extracts and normalizes a valid TXT document", async () => {
    const file = new File(["Java developer  \r\n\r\nSpring Boot"], "resume.txt", { type: "text/plain" });
    await expect(extractDocument(file)).resolves.toMatchObject({
      text: "Java developer\n\nSpring Boot",
      format: "TXT",
      filename: "resume.txt",
    });
  });

  it("rejects an unsupported extension", async () => {
    const file = new File(["resume"], "resume.exe", { type: "application/octet-stream" });
    await expect(extractDocument(file)).rejects.toThrow("Use a PDF, TXT, or DOCX file.");
  });

  it("rejects an empty document", async () => {
    const file = new File([], "resume.txt", { type: "text/plain" });
    await expect(extractDocument(file)).rejects.toThrow("empty");
  });

  it("rejects a fake PDF by its byte signature", async () => {
    const file = new File(["not a real PDF"], "resume.pdf", { type: "application/pdf" });
    await expect(extractDocument(file)).rejects.toThrow("valid PDF signature");
  });

  it("rejects binary content disguised as TXT", async () => {
    const file = new File([new Uint8Array([65, 0, 66])], "resume.txt", { type: "text/plain" });
    await expect(extractDocument(file)).rejects.toThrow("binary data");
  });

  it("rejects files over the byte limit before parsing", async () => {
    const file = new File([new Uint8Array(MAX_FILE_BYTES + 1)], "large.txt", { type: "text/plain" });
    await expect(extractDocument(file)).rejects.toBeInstanceOf(DocumentValidationError);
    await expect(extractDocument(file)).rejects.toThrow("5 MB limit");
  });
});

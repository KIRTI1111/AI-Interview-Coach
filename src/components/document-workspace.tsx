"use client";

import { useRef, useState } from "react";
import { CoachWorkspace } from "@/components/coach-workspace";

type ExtractedDocument = { text: string; characters: number; filename: string; format: string };
type UploadState = { document?: ExtractedDocument; error?: string; loading: boolean };
const emptyState: UploadState = { loading: false };

async function extractFile(file: File): Promise<ExtractedDocument> {
  const formData = new FormData();
  formData.set("file", file);
  const response = await fetch("/api/documents/extract", { method: "POST", body: formData });
  const result = (await response.json()) as { document?: ExtractedDocument; error?: string };
  if (!response.ok || !result.document) throw new Error(result.error ?? "The document could not be processed.");
  return result.document;
}

export function DocumentWorkspace() {
  const [resume, setResume] = useState<UploadState>(emptyState);
  const [jobFile, setJobFile] = useState<UploadState>(emptyState);
  const [jobText, setJobText] = useState("");
  const [showCoaches, setShowCoaches] = useState(false);
  const resumeInput = useRef<HTMLInputElement>(null);
  const jobInput = useRef<HTMLInputElement>(null);

  async function handleFile(file: File | undefined, target: "resume" | "job") {
    if (!file) return;
    const setter = target === "resume" ? setResume : setJobFile;
    setter({ loading: true });
    try {
      const document = await extractFile(file);
      setter({ loading: false, document });
      if (target === "job") setJobText(document.text);
    } catch (error) {
      setter({ loading: false, error: error instanceof Error ? error.message : "Upload failed." });
    }
  }

  function clearResume() {
    setResume(emptyState);
    if (resumeInput.current) resumeInput.current.value = "";
  }

  function clearJobFile() {
    setJobFile(emptyState);
    setJobText("");
    if (jobInput.current) jobInput.current.value = "";
  }

  function startOver() {
    setShowCoaches(false);
    setResume(emptyState);
    setJobFile(emptyState);
    setJobText("");
    if (resumeInput.current) resumeInput.current.value = "";
    if (jobInput.current) jobInput.current.value = "";
  }

  const ready = Boolean(resume.document && jobText.trim().length >= 50);

  if (showCoaches && resume.document) {
    return (
      <CoachWorkspace
        resumeText={resume.document.text}
        jobDescriptionText={jobText.trim()}
        onBack={() => setShowCoaches(false)}
        onStartOver={startOver}
      />
    );
  }

  return (
    <section className="grid gap-6 lg:grid-cols-2">
      <DocumentCard number="01" title="Resume" description="Upload the candidate resume. It stays separate from the job requirements.">
        <FilePicker id="resume-file" inputRef={resumeInput} state={resume} onFile={(file) => handleFile(file, "resume")} onClear={clearResume} />
      </DocumentCard>

      <DocumentCard number="02" title="Job description" description="Paste the job description, or upload it and edit the extracted text.">
        <FilePicker id="job-file" inputRef={jobInput} state={jobFile} onFile={(file) => handleFile(file, "job")} onClear={clearJobFile} compact />
        <div className="my-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-slate-400"><span className="h-px flex-1 bg-slate-200" />or paste below<span className="h-px flex-1 bg-slate-200" /></div>
        <label htmlFor="job-description" className="sr-only">Job description</label>
        <textarea
          id="job-description"
          value={jobText}
          onChange={(event) => setJobText(event.target.value.slice(0, 100_000))}
          maxLength={100_000}
          rows={9}
          placeholder="Paste the complete job description here…"
          className="w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-800 placeholder:text-slate-400"
        />
        <p className="mt-2 text-right text-xs text-slate-400">{jobText.length.toLocaleString()} / 100,000 characters</p>
      </DocumentCard>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold">Context readiness</h2>
            <p className="mt-1 text-sm text-slate-600">{ready ? "Both sources are ready. The next step is connecting the two AI coaches." : "Add a readable resume and at least 50 characters of job-description text."}</p>
          </div>
          <button type="button" disabled={!ready} onClick={() => setShowCoaches(true)} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300" title={ready ? "Open the two AI coaches" : "Complete both documents first"}>Continue to coaches</button>
        </div>
        <div className="mt-6 grid gap-3 border-t border-slate-100 pt-5 text-sm text-slate-600 sm:grid-cols-3">
          <SecurityNote title="Validated twice" text="Browser hints plus strict server checks" />
          <SecurityNote title="Not stored" text="Processed in memory for this session" />
          <SecurityNote title="Private by design" text="No AI request is made in this step" />
        </div>
      </div>
    </section>
  );
}

function DocumentCard({ number, title, description, children }: { number: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <article className="rounded-3xl border border-white/70 bg-white/90 p-6 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] backdrop-blur sm:p-8">
      <div className="mb-6 flex gap-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-xs font-bold text-white">{number}</span>
        <div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{description}</p></div>
      </div>
      {children}
    </article>
  );
}

function FilePicker({ id, inputRef, state, onFile, onClear, compact = false }: {
  id: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  state: UploadState;
  onFile: (file: File | undefined) => void;
  onClear: () => void;
  compact?: boolean;
}) {
  if (state.document) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0"><p className="truncate text-sm font-semibold text-emerald-950">{state.document.filename}</p><p className="mt-1 text-xs text-emerald-700">{state.document.format} · {state.document.characters.toLocaleString()} readable characters</p></div>
          <button type="button" onClick={onClear} className="text-xs font-semibold text-emerald-800 underline">Remove</button>
        </div>
        {!compact && <details className="mt-4 border-t border-emerald-200 pt-3"><summary className="cursor-pointer text-xs font-semibold text-emerald-900">Review extracted text</summary><pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded-xl bg-white/70 p-3 font-sans text-xs leading-5 text-slate-700">{state.document.text}</pre></details>}
      </div>
    );
  }
  return (
    <div>
      <label htmlFor={id} className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 text-center transition hover:border-indigo-400 hover:bg-indigo-50/50 ${compact ? "min-h-28" : "min-h-48"}`}>
        <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-xl text-indigo-700">↑</span>
        <span className="text-sm font-semibold text-slate-800">{state.loading ? "Reading document…" : "Choose a PDF, TXT, or DOCX"}</span>
        <span className="mt-1 text-xs text-slate-500">Maximum 5 MB</span>
      </label>
      <input ref={inputRef} id={id} type="file" className="sr-only" accept=".pdf,.txt,.docx,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={state.loading} onChange={(event) => onFile(event.target.files?.[0])} />
      {state.error && <p role="alert" className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{state.error}</p>}
    </div>
  );
}

function SecurityNote({ title, text }: { title: string; text: string }) {
  return <div className="flex gap-3"><span aria-hidden="true" className="mt-0.5 text-emerald-600">✓</span><div><p className="font-semibold text-slate-800">{title}</p><p className="mt-0.5 text-xs">{text}</p></div></div>;
}

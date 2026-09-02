"use client";

import { useEffect, useRef, useState } from "react";
import { SafeMarkdown } from "@/components/safe-markdown";

type Message = { role: "user" | "assistant"; content: string };
type CoachKind = "resume" | "skills";

const starterQuestions: Record<CoachKind, string[]> = {
  resume: ["How well does my resume match this job?", "What important skills are missing?", "How should I improve my resume summary?"],
  skills: ["Give me 10 important interview questions for this role.", "Which technical topics should I prepare first?", "Quiz me on Java and Spring Boot."],
};

export function CoachWorkspace({ resumeText, jobDescriptionText, onBack, onStartOver }: {
  resumeText: string;
  jobDescriptionText: string;
  onBack: () => void;
  onStartOver: () => void;
}) {
  const [status, setStatus] = useState<{ loading: boolean; connected?: boolean; available?: boolean; model?: string; provider?: string }>({ loading: true });

  useEffect(() => {
    let active = true;
    fetch("/api/ai/status", { cache: "no-store" })
      .then(async (response) => ({ ok: response.ok, data: await response.json() as { connected?: boolean; available?: boolean; model?: string; provider?: string } }))
      .then(({ ok, data }) => active && setStatus({ loading: false, connected: ok && data.connected, available: data.available, model: data.model, provider: data.provider }))
      .catch(() => active && setStatus({ loading: false, connected: false }));
    return () => { active = false; };
  }, []);

  return (
    <section>
      <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button type="button" onClick={onBack} className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold hover:bg-slate-50">← Documents</button>
          <button type="button" onClick={() => { if (window.confirm("Remove both documents and clear both conversations?")) onStartOver(); }} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50">Start over</button>
          <div>
            <p className="text-sm font-bold">Two focused AI coaches</p>
            <p className="text-xs text-slate-500">Histories stay separate and are cleared when this page is refreshed.</p>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      {status.connected && status.available === false && (
        <p role="alert" className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">The AI provider is connected, but model <strong>{status.model}</strong> is unavailable.</p>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <ChatPanel kind="resume" title="Resume & job-match coach" subtitle="Grounded comparison of your two documents" resumeText={resumeText} jobDescriptionText={jobDescriptionText} disabled={!status.connected || status.available === false} />
        <ChatPanel kind="skills" title="Skills interview coach" subtitle="Questions, explanations, and tailored preparation" resumeText={resumeText} jobDescriptionText={jobDescriptionText} disabled={!status.connected || status.available === false} />
      </div>
    </section>
  );
}

function StatusBadge({ status }: { status: { loading: boolean; connected?: boolean; available?: boolean; model?: string; provider?: string } }) {
  if (status.loading) return <span className="rounded-full bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">Checking AI provider…</span>;
  if (!status.connected) return <span className="rounded-full bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">● AI provider unavailable</span>;
  return <span className="rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">● {status.provider ?? "AI"} connected · {status.model}</span>;
}

function ChatPanel({ kind, title, subtitle, resumeText, jobDescriptionText, disabled }: {
  kind: CoachKind;
  title: string;
  subtitle: string;
  resumeText: string;
  jobDescriptionText: string;
  disabled: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [error, setError] = useState("");
  const [retryQuestion, setRetryQuestion] = useState("");
  const abortController = useRef<AbortController | null>(null);
  const endOfMessages = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessages.current?.scrollIntoView({ behavior: loading ? "auto" : "smooth", block: "nearest" });
  }, [messages, streamingText, loading, error]);

  useEffect(() => () => abortController.current?.abort("unmount"), []);

  async function send(text = input, retrying = false) {
    const question = text.trim();
    if (!question || loading || disabled) return;
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf("user");
    const baseMessages = retrying && lastUserIndex >= 0 ? messages.slice(0, lastUserIndex) : messages;
    const nextMessages = [...baseMessages, { role: "user" as const, content: question }].slice(-11);
    setMessages(nextMessages);
    setInput("");
    setError("");
    setStreamingText("");
    setRetryQuestion("");
    setLoading(true);
    const controller = new AbortController();
    abortController.current = controller;
    let fullAnswer = "";
    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ coach: kind, resumeText, jobDescriptionText, messages: nextMessages }),
      });
      if (!response.ok) {
        const result = await response.json() as { error?: string };
        throw new Error(result.error ?? "The coach could not answer.");
      }
      if (!response.body) throw new Error("The coach returned no response stream.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullAnswer += decoder.decode(value, { stream: true });
        setStreamingText(fullAnswer);
      }
      fullAnswer += decoder.decode();
      if (!fullAnswer.trim()) throw new Error("The coach returned an empty answer.");
      setMessages([...nextMessages, { role: "assistant" as const, content: fullAnswer }].slice(-12));
      setStreamingText("");
    } catch (caught) {
      const stopped = controller.signal.aborted;
      const silentCancellation = controller.signal.reason === "clear" || controller.signal.reason === "unmount";
      if (silentCancellation) return;
      if (fullAnswer.trim()) {
        setMessages([...nextMessages, { role: "assistant" as const, content: `${fullAnswer}\n\n[${stopped ? "Response stopped by user." : "Response interrupted."}]` }].slice(-12));
        setStreamingText("");
      }
      setRetryQuestion(question);
      setError(stopped ? "Generation stopped." : caught instanceof Error ? caught.message : "The coach could not answer.");
    } finally {
      if (abortController.current === controller) abortController.current = null;
      setLoading(false);
    }
  }

  function clearChat() {
    if (messages.length === 0 && !loading && !error) return;
    if (!window.confirm(`Clear the ${title} conversation?`)) return;
    abortController.current?.abort("clear");
    setMessages([]);
    setInput("");
    setStreamingText("");
    setError("");
    setRetryQuestion("");
  }

  return (
    <article data-testid={`${kind}-coach`} className="flex h-[min(720px,calc(100vh-2rem))] min-h-[560px] self-start flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)]">
      <header className={`border-b p-5 ${kind === "resume" ? "border-indigo-100 bg-indigo-50/70" : "border-violet-100 bg-violet-50/70"}`}>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">{kind === "resume" ? "Document grounded" : "Technical preparation"}</p>
        <div className="mt-2 flex items-start justify-between gap-4">
          <div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 text-sm text-slate-600">{subtitle}</p></div>
          <button type="button" onClick={clearChat} disabled={messages.length === 0 && !loading && !error} className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white disabled:cursor-not-allowed disabled:opacity-40">Clear chat</button>
        </div>
      </header>

      <div aria-live="polite" className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
        {messages.length === 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-700">Try one of these:</p>
            <div className="flex flex-wrap gap-2">{starterQuestions[kind].map((question) => <button key={question} type="button" disabled={disabled} onClick={() => send(question)} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-left text-xs leading-5 text-slate-700 hover:border-indigo-300 disabled:cursor-not-allowed disabled:opacity-50">{question}</button>)}</div>
          </div>
        )}
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[92%] rounded-2xl px-4 py-3 ${message.role === "user" ? "ml-auto whitespace-pre-wrap bg-slate-950 text-sm leading-6 text-white" : "bg-slate-100"}`}>
            {message.role === "assistant" ? <SafeMarkdown>{message.content}</SafeMarkdown> : message.content}
          </div>
        ))}
        {loading && <div className="max-w-[92%] rounded-2xl bg-slate-100 px-4 py-3">{streamingText ? <SafeMarkdown>{streamingText}</SafeMarkdown> : <span className="text-sm text-slate-500">Thinking…</span>}<span aria-hidden="true" className="ml-1 inline-block h-4 w-1 animate-pulse bg-indigo-500 align-middle" /></div>}
        {error && <div role="alert" className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700"><span>{error}</span>{retryQuestion && <button type="button" onClick={() => void send(retryQuestion, true)} className="shrink-0 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold hover:bg-rose-100">Retry</button>}</div>}
        <div ref={endOfMessages} />
      </div>

      <form onSubmit={(event) => { event.preventDefault(); void send(); }} className="border-t border-slate-100 p-4">
        <label htmlFor={`${kind}-question`} className="sr-only">Question for {title}</label>
        <textarea id={`${kind}-question`} value={input} onChange={(event) => setInput(event.target.value.slice(0, 4_000))} maxLength={4_000} rows={3} disabled={disabled || loading} placeholder={disabled ? "AI provider unavailable" : "Ask a question…"} className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 disabled:cursor-not-allowed disabled:opacity-60" />
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-400">{input.length}/4,000 · {messages.length}/12 history messages retained</span>
          {loading
            ? <button type="button" onClick={() => abortController.current?.abort("stop")} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700">Stop</button>
            : <button type="submit" disabled={disabled || !input.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300">Send</button>}
        </div>
      </form>
    </article>
  );
}

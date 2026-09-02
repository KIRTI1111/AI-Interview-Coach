import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const allowedElements = [
  "h1", "h2", "h3", "h4", "p", "ul", "ol", "li", "strong", "em",
  "a", "blockquote", "pre", "code", "hr", "table", "thead", "tbody",
  "tr", "th", "td", "del",
];

function safeUrl(url: string) {
  return /^(https?:\/\/|mailto:)/i.test(url) ? url : "";
}

export function SafeMarkdown({ children }: { children: string }) {
  return (
    <div className="markdown-content break-words text-sm leading-6 text-slate-800">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        allowedElements={allowedElements}
        skipHtml
        urlTransform={safeUrl}
        components={{
          h1: ({ children: value }) => <h1 className="mb-3 mt-5 text-xl font-bold first:mt-0">{value}</h1>,
          h2: ({ children: value }) => <h2 className="mb-2 mt-5 text-lg font-bold first:mt-0">{value}</h2>,
          h3: ({ children: value }) => <h3 className="mb-2 mt-4 text-base font-bold first:mt-0">{value}</h3>,
          h4: ({ children: value }) => <h4 className="mb-1 mt-3 text-sm font-bold first:mt-0">{value}</h4>,
          p: ({ children: value }) => <p className="my-3 first:mt-0 last:mb-0">{value}</p>,
          ul: ({ children: value }) => <ul className="my-3 list-disc space-y-1 pl-6">{value}</ul>,
          ol: ({ children: value }) => <ol className="my-3 list-decimal space-y-1 pl-6">{value}</ol>,
          li: ({ children: value }) => <li className="pl-1">{value}</li>,
          strong: ({ children: value }) => <strong className="font-bold text-slate-950">{value}</strong>,
          em: ({ children: value }) => <em className="italic">{value}</em>,
          a: ({ href, children: value }) => href ? (
            <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-indigo-700 underline decoration-indigo-300 underline-offset-2 hover:text-indigo-900">{value}</a>
          ) : <span>{value}</span>,
          blockquote: ({ children: value }) => <blockquote className="my-3 border-l-4 border-indigo-200 bg-indigo-50/60 py-2 pl-4 pr-3 text-slate-700">{value}</blockquote>,
          pre: ({ children: value }) => <pre className="my-4 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-5 text-slate-100">{value}</pre>,
          code: ({ children: value, className }) => (
            <code className={className ? `${className} font-mono` : "rounded bg-slate-200 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900"}>{value}</code>
          ),
          hr: () => <hr className="my-5 border-slate-200" />,
          table: ({ children: value }) => <div className="my-4 overflow-x-auto"><table className="w-full border-collapse text-left text-xs">{value}</table></div>,
          th: ({ children: value }) => <th className="border border-slate-300 bg-slate-100 px-3 py-2 font-bold">{value}</th>,
          td: ({ children: value }) => <td className="border border-slate-300 px-3 py-2 align-top">{value}</td>,
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}

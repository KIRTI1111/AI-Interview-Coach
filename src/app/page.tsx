import { DocumentWorkspace } from "@/components/document-workspace";
import { SignInButton, UserButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";

export default async function Home() {
  const { userId } = await auth();
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#e0f2fe_0,transparent_32%),radial-gradient(circle_at_top_right,#ede9fe_0,transparent_28%),#f8fafc] px-4 py-10 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.22em] text-indigo-600">AI Interview Coach</p>
            <h1 className="max-w-3xl text-4xl font-bold tracking-tight sm:text-5xl">Prepare with your real resume and target job.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">Add both documents first. We extract their text securely, show you what the AI will receive, and keep the two sources clearly separated.</p>
          </div>
          {userId && <div className="flex items-center gap-3"><div className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-800">Step 1 of 3 · Build context</div><UserButton /></div>}
        </header>
        {userId ? <DocumentWorkspace /> : (
          <section className="rounded-3xl border border-indigo-100 bg-white p-8 text-center shadow-[0_20px_60px_-30px_rgba(15,23,42,0.25)] sm:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">Private workspace</p>
            <h2 className="mt-3 text-2xl font-bold">Sign in before adding your documents</h2>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600">Authentication keeps each coaching session and its usage limits associated with the correct user. Your resume is still processed temporarily and is not saved by this app.</p>
            <SignInButton mode="modal"><button type="button" className="mt-6 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700">Sign in securely</button></SignInButton>
          </section>
        )}
      </div>
    </main>
  );
}

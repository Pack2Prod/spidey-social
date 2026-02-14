export default function App() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Spidey Social</h1>
          <div className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1 text-xs text-zinc-300">
            API: unknown
          </div>
        </header>

        <p className="mt-3 max-w-2xl text-sm text-zinc-400">
          Post something you are doing right now. People can swing in, connect, and the web disappears later.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-lg font-medium">Web Wall</h2>
            <p className="mt-2 text-sm text-zinc-400">Create and discover short-lived activity posts.</p>
            <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
              Coming soon
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5">
            <h2 className="text-lg font-medium">Spider-Sense</h2>
            <p className="mt-2 text-sm text-zinc-400">Find people open to connecting nearby (later slice).</p>
            <div className="mt-4 rounded-lg border border-dashed border-zinc-800 p-4 text-sm text-zinc-500">
              Coming soon
            </div>
          </section>
        </div>

        <footer className="mt-10 text-xs text-zinc-500">
          Slice 1: Frontend shell ready.
        </footer>
      </div>
    </div>
  );
}
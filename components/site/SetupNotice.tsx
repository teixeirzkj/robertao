import { Database } from "lucide-react";

/** Mostrado quando o banco ainda nao foi vinculado ou esta inacessivel. */
export default function SetupNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-lg rounded-3xl border border-ink/10 bg-paper-100 p-8 text-center">
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
          <Database className="size-6 text-gold" />
        </div>
        <h1 className="mt-5 font-display text-xl font-800 text-ink">
          Banco de dados não conectado
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink/60">{message}</p>
        <div className="mt-6 rounded-2xl border border-ink/10 bg-paper-50 p-4 text-left">
          <p className="text-[11px] uppercase tracking-[0.15em] text-ink/45">Como resolver</p>
          <ol className="mt-3 space-y-2 text-sm text-ink/65">
            <li>1. Crie um Postgres (Vercel Storage, Neon ou Supabase).</li>
            <li>
              2. Defina a variável <code className="text-gold">DATABASE_URL</code> no projeto.
            </li>
            <li>3. Recarregue esta página — as tabelas são criadas automaticamente.</li>
          </ol>
        </div>
      </div>
    </main>
  );
}

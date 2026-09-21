"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertCircle, KeyRound, LockKeyhole } from "lucide-react";
import Button from "@/components/ui/Button";

export default function AdminLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data?.error ?? "Não foi possível entrar.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de conexão.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-paper-radial px-5">
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-sm rounded-3xl border border-ink/10 bg-paper-100 p-8 backdrop-blur"
      >
        <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-gold/30 bg-gold/10">
          <LockKeyhole className="size-6 text-gold" />
        </div>

        <h1 className="mt-5 text-center font-display text-xl font-800 text-ink">
          Painel administrativo
        </h1>
        <p className="mt-1 text-center text-sm text-ink/50">Robertão Premiações</p>

        <div className="mt-7 space-y-1.5">
          <label
            htmlFor="senha"
            className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink/50"
          >
            Senha de acesso
          </label>
          <input
            id="senha"
            type="password"
            autoFocus
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-xl border border-ink/10 bg-paper-50 px-4 py-3 text-sm text-ink outline-none transition-colors placeholder:text-ink/30 focus:border-gold/60"
          />
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        <Button type="submit" size="lg" fullWidth loading={loading} className="mt-6">
          <KeyRound className="size-4" />
          Entrar
        </Button>
      </motion.form>
    </main>
  );
}

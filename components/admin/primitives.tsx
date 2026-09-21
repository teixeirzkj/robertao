"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ toast */

type Toast = { id: number; message: string; kind: "ok" | "erro" };
const ToastCtx = createContext<(message: string, kind?: "ok" | "erro") => void>(() => {});

export function useToast() {
  return useContext(ToastCtx);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);

  const push = useCallback((message: string, kind: "ok" | "erro" = "ok") => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, message, kind }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 4200);
  }, []);

  const value = useMemo(() => push, [push]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[80] flex w-[min(360px,calc(100vw-2.5rem))] flex-col gap-2">
        <AnimatePresence>
          {items.map((t) => (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, x: 40, scale: 0.95 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 380, damping: 30 }}
              className={cn(
                "pointer-events-auto flex items-start gap-2.5 rounded-xl border px-4 py-3 text-sm backdrop-blur",
                t.kind === "ok"
                  ? "border-gold/40 bg-ink-800/95 text-white"
                  : "border-crimson/50 bg-ink-800/95 text-crimson"
              )}
            >
              {t.kind === "ok" ? (
                <Check className="mt-0.5 size-4 shrink-0 text-gold" />
              ) : (
                <X className="mt-0.5 size-4 shrink-0" />
              )}
              <span className="flex-1">{t.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------ layout */

export function Card({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <section
      className={cn("rounded-2xl border border-white/10 bg-ink-800/50 p-4 sm:p-6", className)}
    >
      {(title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
          <div>
            {title && <h2 className="font-display text-base font-700 text-white">{title}</h2>}
            {description && <p className="mt-1 text-xs text-white/45">{description}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      className={cn(
        "rounded-2xl border p-4 sm:p-5",
        accent ? "border-gold/30 bg-gold/5" : "border-white/10 bg-ink-800/50"
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.12em] text-white/40 sm:text-[11px]">
          {label}
        </span>
        <Icon className={cn("size-4", accent ? "text-gold" : "text-white/35")} />
      </div>
      <p
        className={cn(
          "mt-2 font-display text-xl font-800 sm:mt-3 sm:text-2xl",
          accent ? "text-gradient-gold" : "text-white"
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] leading-snug text-white/35 sm:text-xs">{hint}</p>}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ campos */

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
}

export function Input({ label, hint, className, ...props }: InputProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <input
        className={cn(
          "w-full rounded-xl border border-white/10 bg-ink-900/70 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 hover:border-white/20 focus:border-gold/60",
          className
        )}
        {...props}
      />
      {hint && <span className="block text-[11px] text-white/30">{hint}</span>}
    </label>
  );
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function Textarea({ label, hint, className, ...props }: TextareaProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <textarea
        className={cn(
          "w-full resize-y rounded-xl border border-white/10 bg-ink-900/70 px-4 py-3 text-sm leading-relaxed text-white outline-none transition-colors placeholder:text-white/25 hover:border-white/20 focus:border-gold/60",
          className
        )}
        {...props}
      />
      {hint && <span className="block text-[11px] text-white/30">{hint}</span>}
    </label>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: { value: string; label: string }[];
}

export function Select({ label, options, className, ...props }: SelectProps) {
  return (
    <label className="block space-y-1.5">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <select
        className={cn(
          "w-full cursor-pointer rounded-xl border border-white/10 bg-ink-900/70 px-4 py-2.5 text-sm text-white outline-none transition-colors hover:border-white/20 focus:border-gold/60",
          className
        )}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value} className="bg-ink-800">
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Campo de leitura usado nas fichas de titular/ganhador.
 * `multiline` deixa o valor quebrar em varias linhas em vez de truncar — util
 * para e-mail, que nao cabe em meia largura no celular.
 */
export function Detail({
  icon: Icon,
  label,
  value,
  multiline,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-xl border border-white/10 bg-ink-900/50 px-3 py-2.5 sm:px-4 sm:py-3">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-white/35">
        <Icon className="size-3" />
        {label}
      </span>
      <p
        className={cn(
          "mt-1 text-[13px] text-white/85 sm:text-sm",
          multiline ? "break-all leading-snug" : "truncate"
        )}
      >
        {value}
      </p>
    </div>
  );
}

export function Badge({
  children,
  tone = "neutro",
}: {
  children: React.ReactNode;
  tone?: "neutro" | "ouro" | "erro";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em]",
        tone === "ouro" && "border-gold/50 bg-gold/10 text-gold",
        tone === "erro" && "border-crimson/50 bg-crimson/10 text-crimson",
        tone === "neutro" && "border-white/15 bg-white/5 text-white/55"
      )}
    >
      {children}
    </span>
  );
}

/** Confirmacao simples antes de acoes destrutivas. */
export function useConfirm() {
  return useCallback((message: string) => window.confirm(message), []);
}

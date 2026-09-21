"use client";

import { forwardRef, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string | null;
  hint?: string;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, error, hint, className, id, ...props },
  ref
) {
  const autoId = useId();
  const inputId = id ?? autoId;

  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[10px] font-semibold uppercase tracking-[0.1em] text-white/50 sm:text-[11px] sm:tracking-[0.12em]"
      >
        {label}
      </label>
      <input
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error)}
        className={cn(
          "w-full rounded-xl border bg-ink-800/80 px-3 py-3 text-[13px] text-white placeholder:text-white/25 sm:px-4 sm:text-sm",
          "transition-colors duration-200 outline-none",
          error
            ? "border-crimson/70 focus:border-crimson"
            : "border-white/10 focus:border-gold/60 hover:border-white/20",
          className
        )}
        {...props}
      />
      <AnimatePresence initial={false}>
        {(error || hint) && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18 }}
            className={cn("text-xs", error ? "text-crimson" : "text-white/35")}
          >
            {error || hint}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
});

export default Field;

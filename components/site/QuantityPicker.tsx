"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";

export default function QuantityPicker({
  quantity,
  onChange,
  quickPicks,
  min,
  max,
  disabled,
  cta,
}: {
  quantity: number;
  onChange: (value: number) => void;
  quickPicks: number[];
  min: number;
  max: number;
  disabled?: boolean;
  /** Botão de compra, exibido ao lado do seletor de quantidade. */
  cta?: React.ReactNode;
}) {
  const clamp = (value: number) => Math.min(Math.max(value, min), max);
  // Destaca uma das opções como a mais escolhida.
  const popular = quickPicks.length >= 3 ? quickPicks[Math.floor(quickPicks.length / 3)] : null;

  return (
    <div className="space-y-3">
      <p className="text-center text-[13px] font-semibold text-ink/60">
        Quanto mais cotas, mais chances de ganhar!
      </p>

      <div className="grid grid-cols-3 gap-2">
        {quickPicks.map((pick, i) => (
          <motion.button
            key={pick}
            type="button"
            disabled={disabled}
            onClick={() => onChange(clamp(quantity + pick))}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.03 * i, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileTap={{ scale: disabled ? 1 : 0.96 }}
            className={cn(
              "group relative overflow-hidden rounded-xl border px-1.5 pb-2.5 text-center transition-colors duration-200 cursor-pointer",
              "disabled:cursor-not-allowed disabled:opacity-40",
              pick === popular
                ? "border-gold bg-gold/10 pt-6 shadow-gold"
                : "border-ink/10 bg-paper-100 pt-3 hover:border-gold/50"
            )}
          >
            {pick === popular && (
              <span className="absolute inset-x-0 top-0 bg-gold-metal bg-[length:200%_auto] py-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-ink-900">
                Mais popular
              </span>
            )}
            <span
              className={cn(
                "block truncate font-display text-lg font-800 tabular-nums transition-colors sm:text-xl",
                pick === popular ? "text-gold" : "text-ink group-hover:text-gold"
              )}
            >
              +{formatNumber(pick)}
            </span>
            <span className="block text-[9px] font-semibold uppercase tracking-[0.1em] text-ink/40">
              selecionar
            </span>
          </motion.button>
        ))}
      </div>

      <div className={cn("grid gap-2", cta && "sm:grid-cols-2")}>
        <div className="flex items-center gap-2 rounded-xl border border-ink/10 bg-paper-100 p-1.5">
          <button
            type="button"
            disabled={disabled || quantity <= min}
            onClick={() => onChange(clamp(quantity - 1))}
            aria-label="Diminuir"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-ink/10 text-ink transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          >
            <Minus className="size-4" />
          </button>

          <input
            type="number"
            inputMode="numeric"
            value={quantity}
            min={min}
            max={max}
            disabled={disabled}
            onChange={(e) => {
              const raw = Number(e.target.value.replace(/\D+/g, ""));
              onChange(Number.isFinite(raw) && raw > 0 ? Math.min(raw, max) : min);
            }}
            aria-label="Quantidade de cotas"
            className="min-w-0 flex-1 bg-transparent text-center font-display text-2xl font-800 tabular-nums text-ink outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          />

          <button
            type="button"
            disabled={disabled || quantity >= max}
            onClick={() => onChange(clamp(quantity + 1))}
            aria-label="Aumentar"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-ink/10 text-ink transition-colors hover:border-gold/50 hover:text-gold disabled:cursor-not-allowed disabled:opacity-30 cursor-pointer"
          >
            <Plus className="size-4" />
          </button>
        </div>

        {cta}
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { Minus, Plus } from "lucide-react";
import { cn, formatBRL, formatNumber } from "@/lib/utils";
import { AnimatedNumber } from "@/components/ui/Counter";

export default function QuantityPicker({
  quantity,
  onChange,
  quickPicks,
  min,
  max,
  priceCents,
  disabled,
}: {
  quantity: number;
  onChange: (value: number) => void;
  quickPicks: number[];
  min: number;
  max: number;
  priceCents: number;
  disabled?: boolean;
}) {
  const clamp = (value: number) => Math.min(Math.max(value, min), max);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-3">
        {quickPicks.map((pick, i) => (
          <motion.button
            key={pick}
            type="button"
            disabled={disabled}
            onClick={() => onChange(clamp(quantity + pick))}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 * i, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: disabled ? 1 : 1.04 }}
            whileTap={{ scale: disabled ? 1 : 0.95 }}
            className={cn(
              "group relative overflow-hidden rounded-xl border border-white/10 bg-ink-800/70 px-2 py-3 text-center transition-colors duration-200",
              "hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            )}
          >
            <span className="block font-display text-lg font-700 text-white group-hover:text-gold transition-colors">
              +{formatNumber(pick)}
            </span>
            <span className="block text-[10px] uppercase tracking-[0.15em] text-white/35">
              cotas
            </span>
          </motion.button>
        ))}
      </div>

      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-ink-800/70 p-2">
        <button
          type="button"
          disabled={disabled || quantity <= min}
          onClick={() => onChange(clamp(quantity - 1))}
          aria-label="Diminuir"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Minus className="size-4" />
        </button>

        <div className="flex-1 text-center">
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
            className="w-full bg-transparent text-center font-display text-3xl font-800 text-white outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label="Quantidade de cotas"
          />
          <span className="text-[10px] uppercase tracking-[0.2em] text-white/35">cotas</span>
        </div>

        <button
          type="button"
          disabled={disabled || quantity >= max}
          onClick={() => onChange(clamp(quantity + 1))}
          aria-label="Aumentar"
          className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white transition-colors hover:border-gold/50 hover:text-gold disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="size-4" />
        </button>
      </div>

      <div className="flex items-baseline justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
        <span className="text-xs uppercase tracking-[0.18em] text-white/50">Total</span>
        <AnimatedNumber
          value={formatBRL(quantity * priceCents)}
          className="font-display text-2xl font-800 text-gradient-gold"
        />
      </div>
    </div>
  );
}

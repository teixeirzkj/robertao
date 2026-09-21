"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Gallery({ images, title }: { images: string[]; title: string }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [broken, setBroken] = useState<Record<number, boolean>>({});

  const has = images.length > 0;
  const current = has ? images[Math.min(index, images.length - 1)] : null;

  function go(step: number) {
    if (images.length < 2) return;
    setDirection(step);
    setIndex((i) => (i + step + images.length) % images.length);
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-3xl border border-ink/10 bg-paper-100">
        <div className="absolute inset-0 bg-paper-radial" />

        <AnimatePresence initial={false} mode="popLayout" custom={direction}>
          {current && !broken[index] ? (
            <motion.img
              key={current + index}
              src={current}
              alt={title}
              custom={direction}
              initial={{ opacity: 0, scale: 1.04, x: direction * 40 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.98, x: direction * -40 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              onError={() => setBroken((b) => ({ ...b, [index]: true }))}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-ink/30"
            >
              <ImageOff className="size-10" />
              <span className="text-xs uppercase tracking-[0.2em]">Sem imagem</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-white/95 to-transparent" />

        {images.length > 1 && (
          <>
            <button
              onClick={() => go(-1)}
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/12 bg-paper-50 text-ink backdrop-blur transition-colors hover:border-gold/60 hover:text-gold cursor-pointer"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              onClick={() => go(1)}
              aria-label="Proxima imagem"
              className="absolute right-3 top-1/2 z-10 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-ink/12 bg-paper-50 text-ink backdrop-blur transition-colors hover:border-gold/60 hover:text-gold cursor-pointer"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img + i}
              onClick={() => {
                setDirection(i > index ? 1 : -1);
                setIndex(i);
              }}
              className={cn(
                "relative size-16 shrink-0 overflow-hidden rounded-xl border transition-all duration-200 cursor-pointer",
                i === index
                  ? "border-gold shadow-gold"
                  : "border-ink/10 opacity-60 hover:opacity-100"
              )}
            >
              {broken[i] ? (
                <span className="flex size-full items-center justify-center bg-paper-100 text-ink/35">
                  <ImageOff className="size-4" />
                </span>
              ) : (
                <img
                  src={img}
                  alt=""
                  onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                  className="size-full object-cover"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

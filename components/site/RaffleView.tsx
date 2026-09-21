"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  Gift,
  Lock,
  ShieldCheck,
  Sparkles,
  Ticket,
  Trophy,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Reveal from "@/components/ui/Reveal";
import ProgressBar from "@/components/ui/ProgressBar";
import { CounterOnView } from "@/components/ui/Counter";
import Gallery from "@/components/site/Gallery";
import QuantityPicker from "@/components/site/QuantityPicker";
import CheckoutModal from "@/components/site/CheckoutModal";
import { cn, formatBRL, formatNumber, padTicket } from "@/lib/utils";
import type { PublicRaffle } from "@/lib/types";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  ativa: { text: "Rifa aberta", className: "border-gold/40 bg-gold/10 text-gold" },
  pausada: { text: "Vendas pausadas", className: "border-white/20 bg-white/5 text-white/60" },
  encerrada: { text: "Rifa encerrada", className: "border-crimson/40 bg-crimson/10 text-crimson" },
};

export default function RaffleView({
  raffle,
  winner,
}: {
  raffle: PublicRaffle;
  winner: { number: number; name: string } | null;
}) {
  const [quantity, setQuantity] = useState(Math.max(raffle.minQuantity, 1));
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const soldOut = raffle.stats.soldPercent >= 100;
  const closed = raffle.status !== "ativa" || soldOut;
  const status = STATUS_LABEL[raffle.status] ?? STATUS_LABEL.ativa;
  const maxAllowed = raffle.maxQuantity;

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section id="rifa" className="relative overflow-hidden pt-28 pb-16 sm:pt-32">
        <div className="pointer-events-none absolute inset-0 bg-ink-radial" />

        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14">
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            >
              <Gallery images={raffle.images} title={raffle.title} />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-col gap-6"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em]",
                      status.className
                    )}
                  >
                    <span className="size-1.5 rounded-full bg-current animate-pulse-glow" />
                    {soldOut ? "Cotas esgotadas" : status.text}
                  </span>
                  {raffle.drawDate && (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1 text-[11px] text-white/55">
                      <CalendarDays className="size-3" />
                      {raffle.drawDate}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-3xl font-800 leading-[1.08] tracking-tight text-white sm:text-4xl lg:text-5xl">
                  {raffle.title}
                </h1>
                {raffle.subtitle && (
                  <p className="text-base leading-relaxed text-white/55">{raffle.subtitle}</p>
                )}
              </div>

              <div className="flex items-end justify-between rounded-2xl border border-white/10 bg-ink-800/60 px-5 py-4">
                <div>
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Por cota
                  </span>
                  <p className="font-display text-3xl font-800 text-gradient-gold">
                    {formatBRL(raffle.priceCents)}
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[11px] uppercase tracking-[0.18em] text-white/40">
                    Total de cotas
                  </span>
                  <p className="font-display text-xl font-700 text-white">
                    {formatNumber(raffle.totalNumbers)}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/50">
                    <CounterOnView value={Math.round(raffle.stats.soldPercent)} suffix="%" /> vendido
                  </span>
                </div>
                <ProgressBar percent={Math.min(raffle.stats.soldPercent, 100)} />
              </div>

              {closed ? (
                <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-6 text-center">
                  <Lock className="mx-auto size-7 text-white/40" />
                  <p className="mt-3 font-display text-lg font-700 text-white">
                    {soldOut ? "Todas as cotas foram vendidas" : "Vendas indisponíveis"}
                  </p>
                  <p className="mt-1 text-sm text-white/45">
                    {soldOut
                      ? "Acompanhe o sorteio pelas nossas redes sociais."
                      : "Esta rifa não está aceitando compras no momento."}
                  </p>
                </div>
              ) : (
                <>
                  <QuantityPicker
                    quantity={Math.min(quantity, maxAllowed)}
                    onChange={setQuantity}
                    quickPicks={raffle.quickPicks}
                    min={raffle.minQuantity}
                    max={maxAllowed}
                    priceCents={raffle.priceCents}
                  />
                  <Button size="lg" fullWidth onClick={() => setCheckoutOpen(true)}>
                    <Ticket className="size-4" />
                    Quero minhas cotas
                  </Button>
                  <div className="flex items-center justify-center gap-5 text-[11px] text-white/35">
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="size-3.5" /> Números únicos garantidos
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="size-3.5" /> Sorteio após o pagamento
                    </span>
                  </div>
                </>
              )}
            </motion.div>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------- ganhador final */}
      {winner && (
        <section className="relative px-5 pb-16 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-3xl border border-gold bg-gold-metal bg-[length:200%_auto] animate-shine p-8 text-center text-ink-900">
              <Trophy className="mx-auto size-9" />
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.25em]">
                Prêmio principal
              </p>
              <p className="mt-2 font-display text-3xl font-800">
                {winner.name}
              </p>
              <p className="mt-1 text-sm font-semibold">
                Cota vencedora {padTicket(winner.number, raffle.totalNumbers)}
                {raffle.grandPrize && ` · ${raffle.grandPrize}`}
              </p>
            </div>
          </Reveal>
        </section>
      )}

      {/* ------------------------------------------------- cotas premiadas */}
      {raffle.prizes.length > 0 && (
        <section id="premiadas" className="px-5 py-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
                Prêmios instantâneos
              </span>
              <h2 className="mt-2 font-display text-2xl font-800 text-white sm:text-3xl">
                Cotas premiadas
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-white/50">
                Alguns números escondem prêmios que saem na hora da compra. Se um deles
                cair para você, o aviso aparece na tela imediatamente.
              </p>
            </Reveal>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {raffle.prizes.map((prize, i) => (
                <Reveal key={prize.id} delay={i * 0.05}>
                  <div
                    className={cn(
                      "group relative h-full overflow-hidden rounded-2xl border p-5 transition-all duration-300",
                      prize.claimed
                        ? "border-white/5 bg-ink-800/40 opacity-55"
                        : "border-gold/25 bg-ink-800/70 shine-sweep hover:border-gold/60 hover:shadow-gold"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {prize.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prize.image}
                          alt=""
                          className={cn(
                            "size-12 shrink-0 rounded-xl border object-cover",
                            prize.claimed ? "border-white/10 grayscale" : "border-gold/30"
                          )}
                        />
                      ) : (
                        <Gift
                          className={cn(
                            "size-6 shrink-0",
                            prize.claimed ? "text-white/25" : "text-gold"
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          prize.claimed
                            ? "border-white/10 text-white/35"
                            : "border-gold/40 text-gold"
                        )}
                      >
                        {prize.claimed ? "Conquistada" : "Disponível"}
                      </span>
                    </div>
                    <p className="mt-4 font-display text-lg font-700 leading-snug text-white">
                      {prize.label}
                    </p>
                    {prize.valueCents > 0 && (
                      <p className="mt-1 text-sm text-gold/80">{formatBRL(prize.valueCents)}</p>
                    )}
                    <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-white/30">
                      Número secreto
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- como funciona */}
      <section id="como-funciona" className="px-5 py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
              Simples assim
            </span>
            <h2 className="mt-2 font-display text-2xl font-800 text-white sm:text-3xl">
              Como funciona
            </h2>
          </Reveal>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: Ticket,
                title: "Escolha as cotas",
                text: "Defina quantos números você quer levar. Quanto mais cotas, mais chances.",
              },
              {
                icon: Users,
                title: "Preencha seus dados",
                text: "Nome, telefone, e-mail, CPF e data de nascimento para identificar o titular.",
              },
              {
                icon: Sparkles,
                title: "Pague e veja o sorteio",
                text: "Confirmado o pagamento, o sistema sorteia seus números na tela — exclusivos, nunca repetidos.",
              },
              {
                icon: Trophy,
                title: "Concorra a tudo",
                text: "Prêmios instantâneos nas cotas premiadas e o prêmio principal no sorteio final.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.07}>
                <div className="h-full rounded-2xl border border-white/10 bg-ink-800/50 p-6 transition-colors duration-300 hover:border-gold/40">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <item.icon className="size-5 text-gold" />
                  </div>
                  <p className="mt-4 font-display text-base font-700 text-white">{item.title}</p>
                  <p className="mt-2 text-sm leading-relaxed text-white/50">{item.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- descricao */}
      {(raffle.description || raffle.rules) && (
        <section id="regulamento" className="px-5 pb-20 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
            {raffle.description && (
              <Reveal>
                <article className="h-full rounded-3xl border border-white/10 bg-ink-800/50 p-7">
                  <h3 className="font-display text-lg font-700 text-white">Sobre o prêmio</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/60">
                    {raffle.description}
                  </p>
                </article>
              </Reveal>
            )}
            {raffle.rules && (
              <Reveal delay={0.08}>
                <article className="h-full rounded-3xl border border-white/10 bg-ink-800/50 p-7">
                  <h3 className="font-display text-lg font-700 text-white">Regulamento</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/60">
                    {raffle.rules}
                  </p>
                </article>
              </Reveal>
            )}
          </div>
        </section>
      )}

      <CheckoutModal
        raffle={raffle}
        quantity={Math.min(quantity, maxAllowed)}
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
      />
    </>
  );
}

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarDays,
  ChevronDown,
  ChevronUp,
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
import { cn, formatBRL, padTicket } from "@/lib/utils";
import type { PublicRaffle } from "@/lib/types";

const STATUS_LABEL: Record<string, { text: string; className: string }> = {
  ativa: { text: "Rifa aberta", className: "border-gold/40 bg-gold/10 text-gold" },
  pausada: { text: "Vendas pausadas", className: "border-ink/15 bg-ink/5 text-ink/65" },
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
  const [verTodasAsCotas, setVerTodasAsCotas] = useState(false);

  // Acima de 4 cotas premiadas a lista fica grande demais: mostra 4 e um botao.
  const COTAS_VISIVEIS = 4;
  const temMaisCotas = raffle.prizes.length > COTAS_VISIVEIS;
  const cotasExibidas =
    temMaisCotas && !verTodasAsCotas ? raffle.prizes.slice(0, COTAS_VISIVEIS) : raffle.prizes;

  const soldOut = raffle.stats.soldPercent >= 100;
  const closed = raffle.status !== "ativa" || soldOut;
  const status = STATUS_LABEL[raffle.status] ?? STATUS_LABEL.ativa;
  const maxAllowed = raffle.maxQuantity;

  return (
    <>
      {/* ------------------------------------------------------------- hero */}
      <section id="rifa" className="relative overflow-hidden pb-12 pt-24 sm:pb-16 sm:pt-32">
        <div className="pointer-events-none absolute inset-0 bg-paper-radial" />

        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
          <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-14">
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
              className="flex flex-col gap-5 sm:gap-6"
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
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-ink/10 px-3 py-1 text-[11px] text-ink/60">
                      <CalendarDays className="size-3" />
                      {raffle.drawDate}
                    </span>
                  )}
                </div>

                <h1 className="font-display text-3xl font-800 leading-[1.08] tracking-tight text-ink sm:text-4xl lg:text-5xl">
                  {raffle.title}
                </h1>
                {raffle.subtitle && (
                  <p className="text-[15px] leading-relaxed text-ink/60 sm:text-base">{raffle.subtitle}</p>
                )}
              </div>

              <div className="rounded-2xl border border-ink/10 bg-white px-5 py-4">
                <span className="text-[11px] uppercase tracking-[0.18em] text-ink/45">
                  Por cota
                </span>
                <p className="font-display text-3xl font-800 text-gradient-gold">
                  {formatBRL(raffle.priceCents)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-ink/55">
                    <CounterOnView value={Math.round(raffle.stats.soldPercent)} suffix="%" /> vendido
                  </span>
                </div>
                <ProgressBar percent={Math.min(raffle.stats.soldPercent, 100)} />
              </div>

              {closed ? (
                <div className="rounded-2xl border border-ink/10 bg-white p-6 text-center">
                  <Lock className="mx-auto size-7 text-ink/45" />
                  <p className="mt-3 font-display text-lg font-700 text-ink">
                    {soldOut ? "Todas as cotas foram vendidas" : "Vendas indisponíveis"}
                  </p>
                  <p className="mt-1 text-sm text-ink/50">
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
                  <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-ink/40">
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
        <section className="relative px-5 pb-12 sm:pb-16 lg:px-8">
          <Reveal className="mx-auto max-w-6xl">
            <div className="overflow-hidden rounded-3xl border border-gold bg-gold-metal bg-[length:200%_auto] animate-shine p-6 text-center text-ink-900 sm:p-8">
              <Trophy className="mx-auto size-9" />
              <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.25em]">
                Prêmio principal
              </p>
              <p className="mt-2 font-display text-2xl font-800 sm:text-3xl">
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
        <section id="premiadas" className="px-5 py-12 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mb-8 text-center">
              <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
                Prêmios instantâneos
              </span>
              <h2 className="mt-2 font-display text-2xl font-800 text-ink sm:text-3xl">
                Cotas premiadas
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-ink/55">
                Alguns números escondem prêmios que saem na hora da compra. Se um deles
                cair para você, o aviso aparece na tela imediatamente.
              </p>
            </Reveal>

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
              {cotasExibidas.map((prize, i) => (
                <Reveal key={prize.id} delay={i * 0.05}>
                  <div
                    className={cn(
                      "group relative h-full overflow-hidden rounded-2xl border p-4 transition-all duration-300 sm:p-5",
                      prize.claimed
                        ? "border-ink/8 bg-paper-100 opacity-55"
                        : "border-gold/25 bg-white shine-sweep hover:border-gold/60 hover:shadow-gold"
                    )}
                  >
                    <div className="flex flex-col items-start gap-2 sm:flex-row sm:justify-between sm:gap-3">
                      {prize.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={prize.image}
                          alt=""
                          className={cn(
                            "size-10 shrink-0 rounded-xl border object-cover sm:size-12",
                            prize.claimed ? "border-ink/10 grayscale" : "border-gold/30"
                          )}
                        />
                      ) : (
                        <Gift
                          className={cn(
                            "size-6 shrink-0",
                            prize.claimed ? "text-ink/30" : "text-gold"
                          )}
                        />
                      )}
                      <span
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]",
                          prize.claimed
                            ? "border-ink/10 text-ink/40"
                            : "border-gold/40 text-gold"
                        )}
                      >
                        {prize.claimed ? "Conquistada" : "Disponível"}
                      </span>
                    </div>
                    <p className="mt-3 font-display text-base font-700 leading-snug text-ink sm:mt-4 sm:text-lg">
                      {prize.label}
                    </p>
                    {prize.valueCents > 0 && (
                      <p className="mt-1 text-[13px] text-gold/80 sm:text-sm">{formatBRL(prize.valueCents)}</p>
                    )}
                    {prize.number === null ? (
                      <p className="mt-3 text-[10px] uppercase tracking-[0.12em] text-ink/35 sm:text-[11px]">
                        A sortear
                      </p>
                    ) : (
                      <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-[10px] uppercase tracking-[0.12em] text-ink/40">
                          Cota
                        </span>
                        <span
                          className={cn(
                            "font-mono text-lg font-bold tabular-nums",
                            prize.claimed ? "text-ink/40 line-through" : "text-gradient-gold"
                          )}
                        >
                          {padTicket(prize.number, raffle.totalNumbers)}
                        </span>
                      </div>
                    )}
                  </div>
                </Reveal>
              ))}
            </div>

            {temMaisCotas && (
              <div className="mt-6 flex justify-center">
                <Button
                  variant="outline"
                  onClick={() => setVerTodasAsCotas((v) => !v)}
                  aria-expanded={verTodasAsCotas}
                >
                  {verTodasAsCotas ? (
                    <>
                      <ChevronUp className="size-4" />
                      Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" />
                      Ver todas as {raffle.prizes.length} cotas premiadas
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ----------------------------------------------------- como funciona */}
      <section id="como-funciona" className="px-5 py-12 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-10 text-center">
            <span className="text-[11px] font-semibold uppercase tracking-[0.25em] text-gold">
              Simples assim
            </span>
            <h2 className="mt-2 font-display text-2xl font-800 text-ink sm:text-3xl">
              Como funciona
            </h2>
          </Reveal>

          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
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
                <div className="h-full rounded-2xl border border-ink/10 bg-white p-4 transition-colors duration-300 hover:border-gold/40 sm:p-6">
                  <div className="flex size-10 items-center justify-center rounded-xl border border-gold/30 bg-gold/10 sm:size-11">
                    <item.icon className="size-5 text-gold" />
                  </div>
                  <p className="mt-3 font-display text-[15px] font-700 leading-snug text-ink sm:mt-4 sm:text-base">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink/55 sm:mt-2 sm:text-sm">
                    {item.text}
                  </p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------- descricao */}
      {(raffle.description || raffle.rules) && (
        <section id="regulamento" className="px-5 pb-16 sm:pb-20 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
            {raffle.description && (
              <Reveal>
                <article className="h-full rounded-3xl border border-ink/10 bg-white p-5 sm:p-7">
                  <h3 className="font-display text-lg font-700 text-ink">Sobre o prêmio</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/65">
                    {raffle.description}
                  </p>
                </article>
              </Reveal>
            )}
            {raffle.rules && (
              <Reveal delay={0.08}>
                <article className="h-full rounded-3xl border border-ink/10 bg-white p-5 sm:p-7">
                  <h3 className="font-display text-lg font-700 text-ink">Regulamento</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/65">
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

"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  ChevronUp,
  FileText,
  Gift,
  Loader2,
  Lock,
  Search,
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
  ativa: { text: "Adquira já!", className: "bg-gold-metal text-ink-900" },
  pausada: { text: "Vendas pausadas", className: "bg-paper-200 text-ink/70" },
  encerrada: { text: "Rifa encerrada", className: "bg-crimson text-white" },
};

/** Acima deste total, a lista de cotas premiadas vem recolhida. */
const COTAS_VISIVEIS = 4;

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

  const soldOut = raffle.stats.soldPercent >= 100;
  const closed = raffle.status !== "ativa" || soldOut;
  const status = STATUS_LABEL[raffle.status] ?? STATUS_LABEL.ativa;
  const maxAllowed = raffle.maxQuantity;

  const temMaisCotas = raffle.prizes.length > COTAS_VISIVEIS;
  const cotasExibidas =
    temMaisCotas && !verTodasAsCotas ? raffle.prizes.slice(0, COTAS_VISIVEIS) : raffle.prizes;
  const conquistadas = raffle.prizes.filter((p) => p.claimed).length;

  return (
    <>
      <div className="mx-auto max-w-2xl px-4 pb-14 pt-20 sm:px-5 sm:pt-24">
        {/* ----------------------------------------------------------- capa */}
        <motion.section
          id="rifa"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <Gallery images={raffle.images} title={raffle.title}>
            <span
              className={cn(
                "inline-block rounded-md px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em]",
                status.className
              )}
            >
              {soldOut ? "Cotas esgotadas" : status.text}
            </span>
            <h1 className="mt-2 font-display text-lg font-800 uppercase leading-tight tracking-tight text-white sm:text-2xl">
              {raffle.title}
            </h1>
            {raffle.subtitle && (
              <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-white/80 sm:text-xs">
                {raffle.subtitle}
              </p>
            )}
          </Gallery>
        </motion.section>

        {/* barra "meus números" */}
        <Link
          href="/meus-numeros"
          className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-paper-100 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold/50 hover:text-gold"
        >
          <Search className="size-4 text-gold" />
          Meus números
        </Link>

        {/* preço por cota */}
        <div className="mt-2 flex items-center justify-center gap-2.5 py-1">
          <span className="text-sm text-ink/55">Por apenas</span>
          <span className="rounded-lg border border-gold/40 bg-gold/10 px-3 py-1.5 font-display text-xl font-800 text-gold">
            {formatBRL(raffle.priceCents)}
          </span>
        </div>

        {/* atalhos */}
        <div className="mt-1 space-y-2">
          <MenorEMaiorTitulo totalNumbers={raffle.totalNumbers} />
          <a
            href="#premiadas"
            className="flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-paper-100 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold/50 hover:text-gold"
          >
            <Trophy className="size-4 text-gold" />
            Prêmios
          </a>
        </div>

        {/* progresso — a porcentagem e opcional, ligada no admin */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            {raffle.showProgress ? (
              <span className="text-ink/55">
                <CounterOnView value={Math.round(raffle.stats.soldPercent)} suffix="%" /> vendido
              </span>
            ) : (
              <span />
            )}
            {raffle.drawDate && (
              <span className="inline-flex items-center gap-1.5 text-ink/50">
                <CalendarDays className="size-3" />
                {raffle.drawDate}
              </span>
            )}
          </div>
          {raffle.showProgress && (
            <ProgressBar percent={Math.min(raffle.stats.soldPercent, 100)} />
          )}
        </div>

        {/* ------------------------------------------------------- compra */}
        <div className="mt-5">
          {closed ? (
            <div className="rounded-2xl border border-ink/10 bg-paper-100 p-6 text-center">
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
                cta={
                  <Button size="lg" fullWidth onClick={() => setCheckoutOpen(true)}>
                    <Ticket className="size-4 shrink-0" />
                    <span className="flex flex-col items-start leading-tight">
                      <span className="text-xs font-normal">Quero participar</span>
                      <span className="font-display text-base font-800">
                        {formatBRL(Math.min(quantity, maxAllowed) * raffle.priceCents)}
                      </span>
                    </span>
                  </Button>
                }
              />

              <a
                href="#regulamento"
                className="mt-2 flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-paper-100 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold/50 hover:text-gold"
              >
                <FileText className="size-4 text-gold" />
                Descrição / Regulamento
              </a>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1.5 text-[11px] text-ink/45">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="size-3.5" /> Números únicos garantidos
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Sparkles className="size-3.5" /> Sorteio após o pagamento
                </span>
              </div>
            </>
          )}
        </div>

        {/* --------------------------------------------------- ganhador */}
        {winner && (
          <Reveal className="mt-6">
            <div className="overflow-hidden rounded-2xl border border-gold bg-gold-metal bg-[length:200%_auto] animate-shine p-5 text-center text-ink-900">
              <Trophy className="mx-auto size-8" />
              <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.25em]">
                Prêmio principal
              </p>
              <p className="mt-1.5 font-display text-2xl font-800">{winner.name}</p>
              <p className="mt-1 text-sm font-semibold">
                Cota vencedora {padTicket(winner.number, raffle.totalNumbers)}
                {raffle.grandPrize && ` · ${raffle.grandPrize}`}
              </p>
            </div>
          </Reveal>
        )}

        {/* ------------------------------------------- títulos premiados */}
        {raffle.prizes.length > 0 && (
          <section id="premiadas" className="mt-6 scroll-mt-24">
            <Reveal>
              <div className="overflow-hidden rounded-2xl border border-ink/10 bg-paper-100 shadow-card">
                <div className="flex items-center justify-between gap-3 border-b border-ink/8 bg-paper-50 px-4 py-3">
                  <span className="flex items-center gap-2 font-display text-sm font-700 text-ink">
                    <Trophy className="size-4 text-gold" />
                    Títulos premiados
                  </span>
                  <span className="rounded-full border border-gold/40 px-2.5 py-0.5 font-mono text-xs font-bold text-gold">
                    {conquistadas}/{raffle.prizes.length}
                  </span>
                </div>

                <ul className="divide-y divide-ink/8">
                  {cotasExibidas.map((prize) => (
                    <li
                      key={prize.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4",
                        prize.claimed && "bg-gold/5"
                      )}
                    >
                      <span
                        className={cn(
                          "shrink-0 rounded-lg px-2.5 py-1.5 font-mono text-[13px] font-bold tabular-nums sm:text-sm",
                          prize.claimed
                            ? "border border-gold/50 bg-paper-100 text-gold"
                            : "bg-paper-200 text-ink/70"
                        )}
                      >
                        {prize.number === null
                          ? "—"
                          : padTicket(prize.number, raffle.totalNumbers)}
                      </span>

                      <span className="flex-1 truncate text-[13px] font-semibold text-ink/80 sm:text-sm">
                        {prize.valueCents > 0 ? formatBRL(prize.valueCents) : prize.label}
                      </span>

                      {prize.claimed ? (
                        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-gold sm:text-sm">
                          <span className="max-w-[8rem] truncate">
                            {prize.winner ?? "Premiada"}
                          </span>
                          <Trophy className="size-3.5 shrink-0" />
                        </span>
                      ) : (
                        <span className="shrink-0 text-[11px] uppercase tracking-[0.1em] text-ink/40 sm:text-xs">
                          {prize.number === null ? "A sortear" : "Disponível"}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>

                {temMaisCotas && (
                  <button
                    onClick={() => setVerTodasAsCotas((v) => !v)}
                    aria-expanded={verTodasAsCotas}
                    className="flex w-full items-center justify-center gap-2 border-t border-ink/8 bg-paper-50 px-4 py-3 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 cursor-pointer"
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
                  </button>
                )}
              </div>
            </Reveal>
          </section>
        )}
      </div>

      {/* ----------------------------------------------------- como funciona */}
      <section id="como-funciona" className="px-5 py-12 sm:py-16 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Reveal className="mb-8 text-center">
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
                text: "Prêmios instantâneos nas cotas premiadas e o prêmio principal na Loteria Federal.",
              },
            ].map((item, i) => (
              <Reveal key={item.title} delay={i * 0.07}>
                <div className="h-full rounded-2xl border border-ink/10 bg-paper-100 p-4 transition-colors duration-300 hover:border-gold/40 sm:p-6">
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

      {/* -------------------------------------------- descrição e regulamento */}
      {(raffle.description || raffle.rules) && (
        <section id="regulamento" className="scroll-mt-24 px-5 pb-16 sm:pb-20 lg:px-8">
          <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">
            {raffle.description && (
              <Reveal>
                <article className="h-full rounded-2xl border border-ink/10 bg-paper-100 p-5 sm:p-7">
                  <h3 className="font-display text-lg font-700 text-ink">Sobre o prêmio</h3>
                  <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-ink/65">
                    {raffle.description}
                  </p>
                </article>
              </Reveal>
            )}
            {raffle.rules && (
              <Reveal delay={0.08}>
                <article className="h-full rounded-2xl border border-ink/10 bg-paper-100 p-5 sm:p-7">
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

/** Menor e maior cota já vendida, consultadas sob demanda. */
function MenorEMaiorTitulo({ totalNumbers }: { totalNumbers: number }) {
  const [aberto, setAberto] = useState(false);
  const [dados, setDados] = useState<{
    count: number;
    lowest: number | null;
    lowestName: string | null;
    highest: number | null;
    highestName: string | null;
  } | null>(null);
  const [carregando, setCarregando] = useState(false);

  async function alternar() {
    const proximo = !aberto;
    setAberto(proximo);
    if (!proximo || dados) return;

    setCarregando(true);
    try {
      const res = await fetch("/api/raffle/titulos", { cache: "no-store" });
      if (res.ok) setDados(await res.json());
    } catch {
      /* mostra o aviso de indisponivel abaixo */
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-paper-100">
      <button
        onClick={alternar}
        aria-expanded={aberto}
        className="flex w-full items-center justify-center gap-2 py-3 text-sm font-semibold text-ink transition-colors hover:text-gold cursor-pointer"
      >
        <ArrowDownUp className="size-4 text-gold" />
        Menor e maior título
        <ChevronDown
          className={cn("size-4 text-ink/40 transition-transform", aberto && "rotate-180")}
        />
      </button>

      {aberto && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="overflow-hidden border-t border-ink/8"
        >
          {carregando ? (
            <p className="flex items-center justify-center gap-2 py-5 text-sm text-ink/50">
              <Loader2 className="size-4 animate-spin text-gold" />
              Consultando...
            </p>
          ) : !dados || dados.count === 0 ? (
            <p className="py-5 text-center text-sm text-ink/50">
              Nenhuma cota vendida ainda — todos os números estão livres.
            </p>
          ) : (
            <div className="grid grid-cols-2 divide-x divide-ink/8">
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink/45">
                  Menor título
                </p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-ink">
                  {padTicket(dados.lowest!, totalNumbers)}
                </p>
                <p className="mt-1 truncate text-[11px] text-ink/55">{dados.lowestName}</p>
              </div>
              <div className="px-4 py-4 text-center">
                <p className="text-[10px] uppercase tracking-[0.12em] text-ink/45">
                  Maior título
                </p>
                <p className="mt-1 font-mono text-xl font-bold tabular-nums text-gradient-gold">
                  {padTicket(dados.highest!, totalNumbers)}
                </p>
                <p className="mt-1 truncate text-[11px] text-ink/55">{dados.highestName}</p>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}

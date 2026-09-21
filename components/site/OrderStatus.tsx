"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  Clock,
  Copy,
  Gift,
  Loader2,
  QrCode,
  Sparkles,
  Ticket,
  XCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Confetti from "@/components/ui/Confetti";
import { formatBRL, formatNumber, onlyDigits, padTicket } from "@/lib/utils";
import type { PublicOrder, PublicRaffle } from "@/lib/types";

type Phase = "aguardando" | "sorteando" | "revelado" | "cancelado";

const POLL_MS = 4000;

export default function OrderStatus({
  order: initial,
  raffle,
}: {
  order: PublicOrder;
  raffle: PublicRaffle;
}) {
  const [order, setOrder] = useState(initial);
  const [phase, setPhase] = useState<Phase>(() => {
    if (initial.status === "cancelado") return "cancelado";
    if (initial.status === "pago") return "revelado";
    return "aguardando";
  });
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const seenPaid = useRef(initial.status === "pago");

  /** Consulta a situação do pedido; dispara o sorteio quando o pagamento entra. */
  const refresh = useCallback(
    async (manual = false) => {
      if (manual) setChecking(true);
      try {
        const res = await fetch(`/api/orders/${order.code}`, { cache: "no-store" });
        if (!res.ok) return;
        const data: PublicOrder = await res.json();
        setOrder(data);

        if (data.status === "cancelado") {
          setPhase("cancelado");
        } else if (data.status === "pago" && !seenPaid.current) {
          seenPaid.current = true;
          // Primeira vez que vemos o pagamento: roda o sorteio na tela.
          setPhase("sorteando");
          setTimeout(() => setPhase("revelado"), 2800);
        }
        if (manual && data.status === "pendente") {
          setError("O pagamento ainda não foi identificado. Tente de novo em instantes.");
          setTimeout(() => setError(null), 5000);
        }
      } catch {
        if (manual) setError("Falha de conexão.");
      } finally {
        if (manual) setChecking(false);
      }
    },
    [order.code]
  );

  useEffect(() => {
    if (phase !== "aguardando") return;
    const id = setInterval(() => refresh(), POLL_MS);
    return () => clearInterval(id);
  }, [phase, refresh]);

  function copyPix() {
    navigator.clipboard?.writeText(raffle.pixKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const whatsUrl = raffle.whatsapp
    ? `https://wa.me/${onlyDigits(raffle.whatsapp)}?text=${encodeURIComponent(
        `Olá! Fiz o pedido ${order.code} de ${order.quantity} cota(s) e estou enviando o comprovante.`
      )}`
    : null;

  return (
    <div className="mx-auto max-w-2xl px-5 pb-16 pt-24 sm:pb-20 sm:pt-32 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Voltar para a rifa
      </Link>

      {/* resumo do pedido */}
      <div className="mt-6 rounded-3xl border border-white/10 bg-ink-800/50 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">Pedido</p>
            <p className="font-display text-2xl font-800 text-white">{order.code}</p>
            <p className="mt-1 text-sm text-white/50">{order.name}</p>
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-[0.18em] text-white/40">
              {formatNumber(order.quantity)} cota(s)
            </p>
            <p className="font-display text-2xl font-800 text-gradient-gold">
              {formatBRL(order.totalCents)}
            </p>
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {/* ------------------------------------------------ aguardando pagamento */}
        {phase === "aguardando" && (
          <motion.div
            key="aguardando"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3 }}
            className="mt-4 space-y-4"
          >
            <div className="rounded-3xl border border-gold/30 bg-gold/5 p-5 sm:p-6">
              <div className="flex items-center gap-2 text-gold">
                <QrCode className="size-5" />
                <h2 className="font-display text-base font-700">Pague com Pix para liberar</h2>
              </div>

              <p className="mt-3 text-sm leading-relaxed text-white/60">
                Suas cotas são sorteadas assim que o pagamento for confirmado. Enquanto isso,
                elas ficam reservadas para você.
              </p>

              {raffle.pixKey ? (
                <>
                  <button
                    onClick={copyPix}
                    className="mt-4 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-900/70 px-4 py-3.5 text-left transition-colors hover:border-gold/50 cursor-pointer"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-[10px] uppercase tracking-[0.15em] text-white/35">
                        Chave Pix
                      </span>
                      <span className="mt-0.5 block truncate font-mono text-sm text-white/85">
                        {raffle.pixKey}
                      </span>
                    </span>
                    {copied ? (
                      <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-gold">
                        <Check className="size-4" /> copiado
                      </span>
                    ) : (
                      <Copy className="size-4 shrink-0 text-white/45" />
                    )}
                  </button>
                  {raffle.pixName && (
                    <p className="mt-2 text-xs text-white/40">Favorecido: {raffle.pixName}</p>
                  )}
                </>
              ) : (
                <p className="mt-4 rounded-xl border border-white/10 bg-ink-900/60 px-4 py-3 text-sm text-white/50">
                  A chave Pix ainda não foi configurada. Fale com a organização para concluir o
                  pagamento.
                </p>
              )}

              <div className="mt-4 rounded-xl border border-white/10 bg-ink-900/50 px-4 py-3">
                <p className="text-xs leading-relaxed text-white/50">
                  Após pagar, envie o comprovante informando o código{" "}
                  <strong className="text-gold">{order.code}</strong>. A confirmação libera as
                  cotas automaticamente nesta página.
                </p>
              </div>

              {order.expiresAt && <Countdown until={order.expiresAt} />}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {whatsUrl && (
                <Button
                  variant="outline"
                  fullWidth
                  onClick={() => window.open(whatsUrl, "_blank")}
                >
                  Enviar comprovante
                </Button>
              )}
              <Button
                variant="dark"
                fullWidth
                loading={checking}
                onClick={() => refresh(true)}
              >
                Já paguei, verificar
              </Button>
            </div>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex items-start gap-2 rounded-xl border border-white/15 bg-ink-800/70 px-4 py-3 text-sm text-white/60"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" />
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <p className="flex items-center justify-center gap-2 text-center text-xs text-white/30">
              <Loader2 className="size-3.5 animate-spin" />
              Verificando o pagamento automaticamente...
            </p>
          </motion.div>
        )}

        {/* ------------------------------------------------------ o sorteiozinho */}
        {phase === "sorteando" && (
          <motion.div
            key="sorteando"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="mt-4 overflow-hidden rounded-3xl border border-gold/40 bg-ink-800/60 p-6 text-center sm:p-10"
          >
            <div className="flex flex-col items-center gap-5">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-gold/60"
              >
                <Sparkles className="size-6 text-gold" />
              </motion.div>
              <div className="space-y-1">
                <p className="font-display text-xl font-800 text-white">
                  Pagamento confirmado!
                </p>
                <p className="text-sm text-white/50">
                  Sorteando {formatNumber(order.quantity)} números exclusivos para você...
                </p>
              </div>
              <Scramble total={raffle.totalNumbers} />
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------------------ resultado */}
        {phase === "revelado" && (
          <motion.div
            key="revelado"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mt-4 space-y-4"
          >
            {order.prizes.length > 0 ? (
              <motion.div
                initial={{ scale: 0.92, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 220, damping: 18 }}
                className="relative overflow-hidden rounded-3xl border border-gold bg-gold-metal bg-[length:200%_auto] animate-shine p-5 text-center text-ink-900 sm:p-6"
              >
                <Confetti />
                <Gift className="mx-auto size-9" />
                <p className="mt-2 font-display text-xl font-800 uppercase tracking-wide sm:text-2xl">
                  Sua cota foi premiada!
                </p>
                <div className="relative mt-4 space-y-2">
                  {order.prizes.map((prize, i) => (
                    <motion.div
                      key={prize.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + i * 0.12 }}
                      className="flex items-center gap-3 rounded-2xl bg-ink-900/90 p-3 text-left text-white"
                    >
                      {prize.image && (
                        <img
                          src={prize.image}
                          alt=""
                          className="size-14 shrink-0 rounded-xl border border-gold/30 object-cover"
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-display text-base font-700 text-gradient-gold">
                          {prize.label}
                        </p>
                        <p className="text-xs text-white/60">
                          Cota {padTicket(prize.number, raffle.totalNumbers)}
                          {prize.valueCents > 0 && ` · ${formatBRL(prize.valueCents)}`}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
                <p className="relative mt-4 text-xs font-semibold text-ink-900/80">
                  Nossa equipe vai entrar em contato pelo telefone informado.
                </p>
              </motion.div>
            ) : (
              <div className="rounded-3xl border border-white/10 bg-ink-800/60 p-6 text-center">
                <Check className="mx-auto size-8 text-gold" />
                <p className="mt-3 font-display text-lg font-700 text-white">
                  Cotas liberadas com sucesso
                </p>
                <p className="mt-1 text-sm text-white/45">
                  Nenhuma cota premiada desta vez — mas você continua concorrendo ao prêmio
                  principal{raffle.grandPrize ? `: ${raffle.grandPrize}` : ""}.
                </p>
              </div>
            )}

            <div className="rounded-3xl border border-white/10 bg-ink-800/50 p-5 sm:p-6">
              <div className="mb-3 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.15em] text-white/40">
                  <Ticket className="size-3.5" />
                  Seus números
                </span>
                <span className="text-[11px] text-white/40">
                  {formatNumber(order.numbers.length)} cota(s)
                </span>
              </div>
              <div className="flex max-h-72 flex-wrap gap-1.5 overflow-y-auto">
                {order.numbers.map((n, i) => {
                  const isPrize = order.prizes.some((p) => p.number === n);
                  return (
                    <motion.span
                      key={n}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: Math.min(i * 0.012, 1), duration: 0.25 }}
                      className={
                        isPrize
                          ? "rounded-lg bg-gold-metal bg-[length:200%_auto] px-2.5 py-1.5 font-mono text-xs font-bold text-ink-900"
                          : "rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1.5 font-mono text-xs text-white/80"
                      }
                    >
                      {padTicket(n, raffle.totalNumbers)}
                    </motion.span>
                  );
                })}
              </div>
              <p className="mt-4 text-[11px] leading-relaxed text-white/30">
                Guarde o código <strong className="text-white/60">{order.code}</strong> — você
                pode consultar estas cotas quando quiser em{" "}
                <Link href="/meus-numeros" className="text-gold hover:underline">
                  Meus números
                </Link>
                .
              </p>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button variant="outline" fullWidth onClick={() => (window.location.href = "/")}>
                Comprar mais cotas
              </Button>
              <Button fullWidth onClick={() => (window.location.href = "/meus-numeros")}>
                Ver meus números
              </Button>
            </div>
          </motion.div>
        )}

        {/* ------------------------------------------------------------ cancelado */}
        {phase === "cancelado" && (
          <motion.div
            key="cancelado"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 rounded-3xl border border-crimson/40 bg-crimson/5 p-6 text-center sm:p-8"
          >
            <XCircle className="mx-auto size-9 text-crimson" />
            <p className="mt-3 font-display text-lg font-700 text-white">Pedido cancelado</p>
            <p className="mt-1 text-sm text-white/50">
              As cotas deste pedido voltaram a ficar disponíveis. Se foi um engano, fale com a
              organização.
            </p>
            <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
              {whatsUrl && (
                <Button variant="outline" onClick={() => window.open(whatsUrl, "_blank")}>
                  Falar no WhatsApp
                </Button>
              )}
              <Button onClick={() => (window.location.href = "/")}>Voltar para a rifa</Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Tempo restante da reserva das cotas. */
function Countdown({ until }: { until: string }) {
  const [left, setLeft] = useState(() => new Date(until).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => setLeft(new Date(until).getTime() - Date.now()), 1000);
    return () => clearInterval(id);
  }, [until]);

  if (left <= 0) {
    return (
      <p className="mt-4 flex items-center gap-2 text-xs text-white/40">
        <Clock className="size-3.5" />
        A reserva expirou, mas você ainda pode pagar — as cotas serão liberadas se ainda
        houver disponibilidade.
      </p>
    );
  }

  const minutes = Math.floor(left / 60000);
  const seconds = Math.floor((left % 60000) / 1000);

  return (
    <p className="mt-4 flex items-center gap-2 text-xs text-white/45">
      <Clock className="size-3.5 text-gold" />
      Cotas reservadas por{" "}
      <strong className="font-mono text-gold">
        {minutes}:{String(seconds).padStart(2, "0")}
      </strong>
    </p>
  );
}

/** Números embaralhando durante o sorteio. */
function Scramble({ total }: { total: number }) {
  const [values, setValues] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    const id = setInterval(() => {
      setValues(Array.from({ length: 5 }, () => Math.floor(Math.random() * total) + 1));
    }, 80);
    return () => clearInterval(id);
  }, [total]);

  return (
    <div className="flex gap-1.5">
      {values.map((v, i) => (
        <span
          key={i}
          className="rounded-lg border border-gold/30 bg-ink-900 px-3 py-2 font-mono text-sm text-gold/85"
        >
          {padTicket(v, total)}
        </span>
      ))}
    </div>
  );
}

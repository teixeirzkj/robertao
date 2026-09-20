"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Check,
  Copy,
  Gift,
  Loader2,
  Sparkles,
  Ticket,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import Confetti from "@/components/ui/Confetti";
import {
  formatBRL,
  formatCPF,
  formatNumber,
  formatPhone,
  isValidCPF,
  isValidEmail,
  onlyDigits,
  padTicket,
  parseBirthdate,
} from "@/lib/utils";
import type { OrderWithNumbers, PublicRaffle } from "@/lib/types";

type Step = "form" | "drawing" | "done";

interface FormState {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  birthdate: string;
}

const EMPTY: FormState = { name: "", phone: "", email: "", cpf: "", birthdate: "" };

export default function CheckoutModal({
  raffle,
  quantity,
  open,
  onClose,
  onCompleted,
}: {
  raffle: PublicRaffle;
  quantity: number;
  open: boolean;
  onClose: () => void;
  onCompleted: () => void;
}) {
  const [step, setStep] = useState<Step>("form");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderWithNumbers | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && step !== "drawing") close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, step]);

  function close() {
    onClose();
    if (step === "done") onCompleted();
    setTimeout(() => {
      setStep("form");
      setOrder(null);
      setApiError(null);
      setErrors({});
      setForm(EMPTY);
    }, 300);
  }

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    const name = form.name.trim().replace(/\s+/g, " ");
    if (name.length < 5 || !name.includes(" ")) next.name = "Informe seu nome completo.";
    if (onlyDigits(form.phone).length < 10) next.phone = "Telefone com DDD e obrigatorio.";
    if (!isValidEmail(form.email)) next.email = "E-mail invalido.";
    if (!isValidCPF(form.cpf)) next.cpf = "CPF invalido.";
    if (!parseBirthdate(form.birthdate))
      next.birthdate = "Use dd/mm/aaaa. E necessario ter 18 anos ou mais.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setStep("drawing");
    const startedAt = Date.now();

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity }),
      });
      const data = await res.json();

      // Segura a animacao de sorteio por pelo menos 1,6s.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 1600) await new Promise((r) => setTimeout(r, 1600 - elapsed));

      if (!res.ok) {
        setApiError(data?.error ?? "Nao foi possivel concluir a compra.");
        setStep("form");
        return;
      }

      setOrder(data as OrderWithNumbers);
      setStep("done");
    } catch {
      setApiError("Falha de conexao. Verifique sua internet e tente novamente.");
      setStep("form");
    }
  }

  function copyPix() {
    navigator.clipboard?.writeText(raffle.pixKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const totalCents = quantity * raffle.priceCents;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/80 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && step !== "drawing") close();
          }}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-white/10 bg-ink-900 shadow-card-hover sm:rounded-3xl"
          >
            {step === "done" && order && order.prizes.length > 0 && <Confetti />}

            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-white/5 bg-ink-900/95 px-5 py-4 backdrop-blur">
              <h2 className="font-display text-base font-700 text-white">
                {step === "done" ? "Cotas garantidas!" : "Finalizar compra"}
              </h2>
              {step !== "drawing" && (
                <button
                  onClick={close}
                  aria-label="Fechar"
                  className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white/60 transition-colors hover:border-gold/50 hover:text-gold cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <div className="p-5">
              <AnimatePresence mode="wait">
                {step === "form" && (
                  <motion.form
                    key="form"
                    onSubmit={submit}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-4"
                  >
                    <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
                      <div>
                        <p className="font-display text-xl font-800 text-white">
                          {formatNumber(quantity)}{" "}
                          <span className="text-sm font-normal text-white/50">cotas</span>
                        </p>
                        <p className="text-xs text-white/40">{raffle.title}</p>
                      </div>
                      <span className="font-display text-xl font-800 text-gradient-gold">
                        {formatBRL(totalCents)}
                      </span>
                    </div>

                    <Field
                      label="Nome completo"
                      placeholder="Maria Souza da Silva"
                      autoComplete="name"
                      value={form.name}
                      error={errors.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field
                        label="Telefone / WhatsApp"
                        placeholder="(11) 99999-9999"
                        inputMode="tel"
                        autoComplete="tel"
                        value={form.phone}
                        error={errors.phone}
                        onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })}
                      />
                      <Field
                        label="CPF"
                        placeholder="000.000.000-00"
                        inputMode="numeric"
                        value={form.cpf}
                        error={errors.cpf}
                        onChange={(e) => setForm({ ...form, cpf: formatCPF(e.target.value) })}
                      />
                    </div>
                    <Field
                      label="E-mail"
                      type="email"
                      placeholder="voce@email.com"
                      autoComplete="email"
                      value={form.email}
                      error={errors.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                    />
                    <Field
                      label="Data de nascimento"
                      placeholder="dd/mm/aaaa"
                      inputMode="numeric"
                      value={form.birthdate}
                      error={errors.birthdate}
                      onChange={(e) => {
                        const d = onlyDigits(e.target.value).slice(0, 8);
                        const masked = d
                          .replace(/^(\d{2})(\d)/, "$1/$2")
                          .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3");
                        setForm({ ...form, birthdate: masked });
                      }}
                    />

                    <AnimatePresence>
                      {apiError && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className="flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson"
                        >
                          <AlertCircle className="mt-0.5 size-4 shrink-0" />
                          <span>{apiError}</span>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <Button type="submit" size="lg" fullWidth>
                      <Ticket className="size-4" />
                      Garantir minhas cotas
                    </Button>
                    <p className="text-center text-[11px] leading-relaxed text-white/30">
                      Seus dados sao usados apenas para identificar o titular das cotas e
                      entrar em contato caso voce seja premiado.
                    </p>
                  </motion.form>
                )}

                {step === "drawing" && (
                  <motion.div
                    key="drawing"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex flex-col items-center justify-center gap-5 py-16 text-center"
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                      className="flex size-16 items-center justify-center rounded-full border-2 border-dashed border-gold/60"
                    >
                      <Sparkles className="size-6 text-gold" />
                    </motion.div>
                    <div className="space-y-1">
                      <p className="font-display text-lg font-700 text-white">
                        Sorteando suas cotas...
                      </p>
                      <p className="text-sm text-white/40">
                        Estamos separando {formatNumber(quantity)} numeros exclusivos para voce.
                      </p>
                    </div>
                    <ScrambleNumbers total={raffle.totalNumbers} />
                  </motion.div>
                )}

                {step === "done" && order && (
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    className="space-y-5"
                  >
                    {order.prizes.length > 0 ? (
                      <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.15, type: "spring", stiffness: 220, damping: 18 }}
                        className="relative overflow-hidden rounded-2xl border border-gold bg-gold-metal bg-[length:200%_auto] animate-shine p-5 text-center text-ink-900"
                      >
                        <Gift className="mx-auto size-8" />
                        <p className="mt-2 font-display text-xl font-800 uppercase tracking-wide">
                          Sua cota foi premiada!
                        </p>
                        <div className="mt-3 space-y-2">
                          {order.prizes.map((prize, i) => (
                            <motion.div
                              key={prize.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.3 + i * 0.12 }}
                              className="rounded-xl bg-ink-900/85 px-4 py-3 text-white"
                            >
                              <p className="font-display text-base font-700 text-gradient-gold">
                                {prize.label}
                              </p>
                              <p className="text-xs text-white/60">
                                Cota {padTicket(prize.number, raffle.totalNumbers)}
                                {prize.valueCents > 0 && ` · ${formatBRL(prize.valueCents)}`}
                              </p>
                            </motion.div>
                          ))}
                        </div>
                        <p className="mt-3 text-xs font-medium text-ink-900/80">
                          Nossa equipe vai entrar em contato pelo telefone informado.
                        </p>
                      </motion.div>
                    ) : (
                      <div className="rounded-2xl border border-white/10 bg-ink-800/60 p-4 text-center">
                        <Check className="mx-auto size-7 text-gold" />
                        <p className="mt-2 font-display text-base font-700 text-white">
                          Cotas registradas com sucesso
                        </p>
                        <p className="text-xs text-white/45">
                          Nenhuma cota premiada desta vez — mas voce continua concorrendo ao
                          premio principal.
                        </p>
                      </div>
                    )}

                    <div className="rounded-2xl border border-white/10 bg-ink-800/50 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-[0.15em] text-white/40">
                          Seus numeros
                        </span>
                        <span className="text-[11px] text-white/40">
                          Pedido {order.code}
                        </span>
                      </div>
                      <div className="flex max-h-48 flex-wrap gap-1.5 overflow-y-auto">
                        {order.numbers.map((n, i) => {
                          const isPrize = order.prizes.some((p) => p.number === n);
                          return (
                            <motion.span
                              key={n}
                              initial={{ opacity: 0, scale: 0.6 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: Math.min(i * 0.015, 0.8), duration: 0.25 }}
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
                    </div>

                    {raffle.pixKey && (
                      <div className="rounded-2xl border border-gold/25 bg-gold/5 p-4">
                        <p className="text-[11px] uppercase tracking-[0.15em] text-white/45">
                          Pague com Pix para confirmar
                        </p>
                        <p className="mt-1 font-display text-2xl font-800 text-gradient-gold">
                          {formatBRL(order.totalCents)}
                        </p>
                        <button
                          onClick={copyPix}
                          className="mt-3 flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-900/70 px-4 py-3 text-left transition-colors hover:border-gold/50 cursor-pointer"
                        >
                          <span className="min-w-0 flex-1 truncate font-mono text-xs text-white/80">
                            {raffle.pixKey}
                          </span>
                          {copied ? (
                            <Check className="size-4 shrink-0 text-gold" />
                          ) : (
                            <Copy className="size-4 shrink-0 text-white/50" />
                          )}
                        </button>
                        {raffle.pixName && (
                          <p className="mt-2 text-xs text-white/40">
                            Favorecido: {raffle.pixName}
                          </p>
                        )}
                        <p className="mt-2 text-[11px] leading-relaxed text-white/35">
                          Envie o comprovante no WhatsApp informando o codigo{" "}
                          <strong className="text-gold">{order.code}</strong>.
                        </p>
                      </div>
                    )}

                    <div className="flex flex-col gap-2 sm:flex-row">
                      {raffle.whatsapp && (
                        <Button
                          variant="outline"
                          fullWidth
                          onClick={() =>
                            window.open(
                              `https://wa.me/${onlyDigits(raffle.whatsapp)}?text=${encodeURIComponent(
                                `Ola! Acabei de comprar ${order.quantity} cota(s). Pedido ${order.code}.`
                              )}`,
                              "_blank"
                            )
                          }
                        >
                          Enviar comprovante
                        </Button>
                      )}
                      <Button fullWidth onClick={close}>
                        Concluir
                      </Button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Numeros embaralhando durante o sorteio. */
function ScrambleNumbers({ total }: { total: number }) {
  const [values, setValues] = useState<number[]>([1, 2, 3, 4, 5]);

  useEffect(() => {
    const id = setInterval(() => {
      setValues(Array.from({ length: 5 }, () => Math.floor(Math.random() * total) + 1));
    }, 90);
    return () => clearInterval(id);
  }, [total]);

  return (
    <div className="flex gap-1.5">
      {values.map((v, i) => (
        <span
          key={i}
          className="rounded-lg border border-gold/25 bg-ink-800 px-2.5 py-1.5 font-mono text-xs text-gold/80"
        >
          {padTicket(v, total)}
        </span>
      ))}
    </div>
  );
}

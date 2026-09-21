"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, Loader2, Lock, Ticket, X } from "lucide-react";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import {
  formatBRL,
  formatCPF,
  formatNumber,
  formatPhone,
  isValidCPF,
  isValidEmail,
  onlyDigits,
  parseBirthdate,
} from "@/lib/utils";
import type { PublicRaffle } from "@/lib/types";

interface FormState {
  name: string;
  phone: string;
  email: string;
  cpf: string;
  birthdate: string;
}

const EMPTY: FormState = { name: "", phone: "", email: "", cpf: "", birthdate: "" };

/**
 * Coleta os dados do comprador e cria o pedido (pendente, sem cotas).
 * As cotas são sorteadas só depois do pagamento, na página do pedido.
 */
export default function CheckoutModal({
  raffle,
  quantity,
  open,
  onClose,
}: {
  raffle: PublicRaffle;
  quantity: number;
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !sending) close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sending]);

  function close() {
    onClose();
    setTimeout(() => {
      setApiError(null);
      setErrors({});
    }, 300);
  }

  function validate() {
    const next: Partial<Record<keyof FormState, string>> = {};
    const name = form.name.trim().replace(/\s+/g, " ");
    if (name.length < 5 || !name.includes(" ")) next.name = "Informe seu nome completo.";
    if (onlyDigits(form.phone).length < 10) next.phone = "Telefone com DDD é obrigatório.";
    if (!isValidEmail(form.email)) next.email = "E-mail inválido.";
    if (!isValidCPF(form.cpf)) next.cpf = "CPF inválido.";
    if (!parseBirthdate(form.birthdate))
      next.birthdate = "Use dd/mm/aaaa. É necessário ter 18 anos ou mais.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setApiError(null);
    if (!validate()) return;

    setSending(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, quantity }),
      });
      const data = await res.json();
      if (!res.ok) {
        setApiError(data?.error ?? "Não foi possível criar o pedido.");
        setSending(false);
        return;
      }
      // A página do pedido cuida do pagamento e do sorteio das cotas.
      router.push(`/pedido/${data.code}`);
    } catch {
      setApiError("Falha de conexão. Verifique sua internet e tente novamente.");
      setSending(false);
    }
  }

  const totalCents = quantity * raffle.priceCents;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !sending) close();
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-ink/10 bg-paper shadow-card-hover sm:rounded-3xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-ink/8 bg-paper/95 px-5 py-4 backdrop-blur">
              <h2 className="font-display text-base font-700 text-ink">Seus dados</h2>
              {!sending && (
                <button
                  onClick={close}
                  aria-label="Fechar"
                  className="flex size-9 items-center justify-center rounded-full border border-ink/10 text-ink/65 transition-colors hover:border-gold/50 hover:text-gold cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            <form onSubmit={submit} className="space-y-3.5 p-4 sm:space-y-4 sm:p-5">
              <div className="flex items-center justify-between rounded-2xl border border-gold/20 bg-gold/5 px-4 py-3">
                <div>
                  <p className="font-display text-xl font-800 text-ink">
                    {formatNumber(quantity)}{" "}
                    <span className="text-sm font-normal text-ink/55">cotas</span>
                  </p>
                  <p className="text-xs text-ink/45">{raffle.title}</p>
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
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <Field
                  label="Telefone / WhatsApp"
                  placeholder="(11) 90000-0000"
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
                  setForm({
                    ...form,
                    birthdate: d
                      .replace(/^(\d{2})(\d)/, "$1/$2")
                      .replace(/^(\d{2})\/(\d{2})(\d)/, "$1/$2/$3"),
                  });
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

              <div className="flex items-start gap-2.5 rounded-xl border border-ink/10 bg-paper-100 px-4 py-3">
                <Lock className="mt-0.5 size-4 shrink-0 text-gold" />
                <p className="text-[11px] leading-relaxed text-ink/55">
                  Seus números são sorteados <strong className="text-ink/75">após a
                  confirmação do pagamento</strong>. No próximo passo você paga e vê as cotas
                  na hora.
                </p>
              </div>

              <Button type="submit" size="lg" fullWidth loading={sending}>
                {sending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Criando pedido...
                  </>
                ) : (
                  <>
                    <Ticket className="size-4" />
                    Ir para o pagamento
                  </>
                )}
              </Button>
              <p className="text-center text-[11px] leading-relaxed text-ink/35">
                Seus dados são usados apenas para identificar o titular das cotas e entrar em
                contato caso você seja premiado.
              </p>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

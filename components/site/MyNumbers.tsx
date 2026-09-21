"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Clock, Gift, Search, Ticket } from "lucide-react";
import Link from "next/link";
import Button from "@/components/ui/Button";
import Field from "@/components/ui/Field";
import { formatBRL, formatDateTimeBR, onlyDigits, padTicket } from "@/lib/utils";
import type { OrderWithNumbers } from "@/lib/types";

const STATUS: Record<string, { label: string; className: string }> = {
  pendente: { label: "Aguardando pagamento", className: "border-ink/15 text-ink/65" },
  pago: { label: "Pagamento confirmado", className: "border-gold/50 text-gold" },
  cancelado: { label: "Cancelado", className: "border-crimson/50 text-crimson" },
};

export default function MyNumbers({ totalNumbers }: { totalNumbers: number }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<OrderWithNumbers[] | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const term = value.trim();
    if (!term) return;
    setLoading(true);
    setError(null);
    setOrders(null);

    // Codigo do pedido (RBXXXXXX) ou documento/telefone.
    const isCode = /^RB[A-Z0-9]{6}$/i.test(term);
    const url = isCode
      ? `/api/orders/lookup?code=${encodeURIComponent(term.toUpperCase())}`
      : `/api/orders/lookup?doc=${encodeURIComponent(onlyDigits(term))}`;

    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Não encontramos nada com esses dados.");
      } else if (!data.orders?.length) {
        setError("Nenhuma compra encontrada. Confira o CPF, telefone ou código do pedido.");
      } else {
        setOrders(data.orders);
      }
    } catch {
      setError("Falha de conexão. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-5 pb-16 pt-24 sm:pb-20 sm:pt-32 lg:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-ink/55 transition-colors hover:text-gold"
      >
        <ArrowLeft className="size-4" />
        Voltar para a rifa
      </Link>

      <div className="mt-6 space-y-2">
        <h1 className="font-display text-3xl font-800 text-ink sm:text-4xl">Meus números</h1>
        <p className="text-sm text-ink/55">
          Consulte suas cotas pelo CPF, telefone ou código do pedido.
        </p>
      </div>

      <form onSubmit={search} className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-start">
        <div className="flex-1">
          <Field
            label="CPF, telefone ou código do pedido"
            placeholder="000.000.000-00 ou RBAB12CD"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <Button type="submit" size="lg" loading={loading} className="sm:mt-[26px]">
          <Search className="size-4" />
          Consultar
        </Button>
      </form>

      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            key="error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-6 flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {orders && (
          <motion.div
            key="results"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-8 space-y-4"
          >
            {orders.map((order) => {
              const status = STATUS[order.status] ?? STATUS.pendente;
              return (
                <div
                  key={order.id}
                  className="rounded-3xl border border-ink/10 bg-white p-5 sm:p-6"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-display text-lg font-700 text-ink">{order.name}</p>
                      <p className="text-xs text-ink/45">
                        Pedido {order.code} · {formatDateTimeBR(order.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  {order.prizes.length > 0 && (
                    <div className="mt-4 space-y-2">
                      {order.prizes.map((prize) => (
                        <div
                          key={prize.id}
                          className="flex items-center gap-3 rounded-2xl border border-gold/40 bg-gold/10 px-4 py-3"
                        >
                          <Gift className="size-5 shrink-0 text-gold" />
                          <div>
                            <p className="font-display text-sm font-700 text-gold">
                              Cota premiada: {prize.label}
                            </p>
                            <p className="text-xs text-ink/55">
                              Número {padTicket(prize.number, totalNumbers)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="mt-5">
                    <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-[0.15em] text-ink/45">
                      <span className="inline-flex items-center gap-1.5">
                        <Ticket className="size-3.5" />
                        {order.quantity} cota(s)
                      </span>
                      <span>{formatBRL(order.totalCents)}</span>
                    </div>

                    {order.numbers.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-ink/12 bg-paper-50 px-4 py-5 text-center">
                        <Clock className="mx-auto size-6 text-ink/35" />
                        <p className="mt-2 text-sm text-ink/65">
                          {order.status === "cancelado"
                            ? "Pedido cancelado — as cotas voltaram para a rifa."
                            : "Seus números são sorteados quando o pagamento for confirmado."}
                        </p>
                        {order.status === "pendente" && (
                          <Link
                            href={`/pedido/${order.code}`}
                            className="mt-3 inline-block rounded-xl border border-gold/50 px-4 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
                          >
                            Concluir pagamento
                          </Link>
                        )}
                      </div>
                    ) : (
                    <div className="flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
                      {order.numbers.map((n) => {
                        const isPrize = order.prizes.some((p) => p.number === n);
                        return (
                          <span
                            key={n}
                            className={
                              isPrize
                                ? "rounded-lg bg-gold-metal bg-[length:200%_auto] px-2.5 py-1.5 font-mono text-xs font-bold text-ink-900"
                                : "rounded-lg border border-ink/10 bg-paper-100 px-2.5 py-1.5 font-mono text-xs text-ink/75"
                            }
                          >
                            {padTicket(n, totalNumbers)}
                          </span>
                        );
                      })}
                    </div>
                    )}
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

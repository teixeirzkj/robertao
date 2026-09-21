"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Gift, Mail, Phone, Search, Ticket, User } from "lucide-react";
import Button from "@/components/ui/Button";
import { Badge, Card, Detail, useToast } from "@/components/admin/primitives";
import TicketRange from "@/components/admin/TicketRange";
import { formatBRL, formatDateBR, formatDateTimeBR, onlyDigits, padTicket } from "@/lib/utils";
import type { Order } from "@/lib/types";

interface Lookup {
  number: number;
  status: "vendida" | "disponivel";
  prize: { id: number; label: string; valueCents: number; claimed: boolean } | null;
  order: Order | null;
}

export default function TicketSearchTab({
  totalNumbers,
  priceCents,
}: {
  totalNumbers: number;
  priceCents: number;
}) {
  const toast = useToast();
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Lookup | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const number = onlyDigits(value);
    if (!number) return;
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch(`/api/admin/tickets?number=${number}`);
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Cota não encontrada.", "erro");
        return;
      }
      setResult(data);
    } catch {
      toast("Falha de conexão.", "erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-5">
      <Card
        title="Buscar cota"
        description="Digite o número sorteado para ver imediatamente quem é o titular."
      >
        <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Ticket className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-ink/35" />
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              inputMode="numeric"
              autoFocus
              placeholder={`Número da cota (1 a ${totalNumbers})`}
              className="w-full rounded-xl border border-ink/10 bg-paper-50 py-3.5 pl-11 pr-4 font-mono text-lg text-ink outline-none transition-colors placeholder:font-body placeholder:text-sm placeholder:text-ink/30 focus:border-gold/60"
            />
          </div>
          <Button type="submit" size="lg" loading={loading}>
            <Search className="size-4" />
            Buscar
          </Button>
        </form>
      </Card>

      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.number}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gold/30 bg-gold/5 p-6">
              <div className="rounded-2xl border border-gold/50 bg-paper-50 px-5 py-3">
                <span className="font-mono text-3xl font-bold text-gradient-gold">
                  {padTicket(result.number, totalNumbers)}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {result.status === "vendida" ? (
                  <Badge tone="ouro">Cota vendida</Badge>
                ) : (
                  <Badge>Ainda disponível</Badge>
                )}
                {result.prize && (
                  <Badge tone={result.prize.claimed ? "ouro" : "neutro"}>
                    <Gift className="size-3" />
                    {result.prize.claimed ? "Premiada e conquistada" : "Premiada (não vendida)"}
                  </Badge>
                )}
              </div>
            </div>

            {result.prize && (
              <Card title="Prêmio vinculado a esta cota">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <Gift className="size-5 text-gold" />
                  </div>
                  <div>
                    <p className="font-display text-base font-700 text-ink">
                      {result.prize.label}
                    </p>
                    {result.prize.valueCents > 0 && (
                      <p className="text-sm text-gold/80">{formatBRL(result.prize.valueCents)}</p>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {result.order ? (
              <Card title="Titular da cota">
                <div className="space-y-4">
                  <div>
                    <p className="font-display text-xl font-800 text-ink">
                      {result.order.name}
                    </p>
                    <p className="text-xs text-ink/45">
                      Pedido {result.order.code} · {result.order.quantity} cota(s) ·{" "}
                      {formatBRL(result.order.totalCents)} ·{" "}
                      {formatDateTimeBR(result.order.createdAt)}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    <Detail icon={Phone} label="Telefone" value={result.order.phone} />
                    <Detail icon={Mail} label="E-mail" value={result.order.email} multiline />
                    <Detail icon={User} label="CPF" value={result.order.cpf} />
                    <Detail
                      icon={User}
                      label="Nascimento"
                      value={formatDateBR(result.order.birthdate)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(`tel:+55${onlyDigits(result.order!.phone)}`, "_self")
                      }
                    >
                      <Phone className="size-4" />
                      Ligar agora
                    </Button>
                    <Button
                      variant="dark"
                      onClick={() =>
                        window.open(
                          `https://wa.me/55${onlyDigits(result.order!.phone)}`,
                          "_blank"
                        )
                      }
                    >
                      Abrir WhatsApp
                    </Button>
                  </div>

                  <div className="rounded-xl border border-ink/10 bg-paper-50 px-4 py-3">
                    <span className="text-[10px] uppercase tracking-[0.15em] text-ink/40">
                      Status do pagamento
                    </span>
                    <p className="mt-1 text-sm text-ink/85">
                      {result.order.status === "pago"
                        ? `Pago em ${formatDateTimeBR(result.order.paidAt)}`
                        : result.order.status === "cancelado"
                          ? "Pedido cancelado"
                          : "Aguardando pagamento"}
                    </p>
                  </div>
                </div>
              </Card>
            ) : (
              <Card>
                <p className="py-6 text-center text-sm text-ink/45">
                  Esta cota ainda não foi vendida — nenhum titular vinculado.
                </p>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>

      <div className="border-t border-ink/8 pt-8">
        <TicketRange totalNumbers={totalNumbers} priceCents={priceCents} />
      </div>
    </div>
  );
}


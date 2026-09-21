"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  CalendarClock,
  Phone,
  Search,
  Ticket,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, Input, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateTimeBR, formatNumber, onlyDigits, padTicket } from "@/lib/utils";
import type { TicketRange as Range } from "@/lib/types";

/** `2026-09-21T18:30` para o input datetime-local. */
function toLocalInput(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

const ATALHOS = [
  { label: "Hoje", horas: null as number | null, hoje: true },
  { label: "Últimas 24h", horas: 24 },
  { label: "Últimos 7 dias", horas: 24 * 7 },
  { label: "Desde o início", horas: null },
];

export default function TicketRange({
  totalNumbers,
  priceCents,
}: {
  totalNumbers: number;
  priceCents: number;
}) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState(() => toLocalInput(new Date()));
  const [range, setRange] = useState<Range | null>(null);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const buscar = useCallback(
    async (fromValue: string, toValue: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (fromValue) params.set("from", new Date(fromValue).toISOString());
        if (toValue) params.set("to", new Date(toValue).toISOString());
        const res = await fetch(`/api/admin/tickets/range?${params}`);
        const data = await res.json();
        if (!res.ok) {
          toast(data?.error ?? "Não foi possível consultar.", "erro");
          return;
        }
        setRange(data);
      } catch {
        toast("Falha de conexão.", "erro");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Primeira carga: a rifa inteira até agora.
  useEffect(() => {
    buscar("", toLocalInput(new Date()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function aplicarAtalho(atalho: (typeof ATALHOS)[number]) {
    const agora = new Date();
    let novoFrom = "";
    if (atalho.hoje) {
      const inicio = new Date(agora);
      inicio.setHours(0, 0, 0, 0);
      novoFrom = toLocalInput(inicio);
    } else if (atalho.horas) {
      novoFrom = toLocalInput(new Date(agora.getTime() - atalho.horas * 3600_000));
    }
    const novoTo = toLocalInput(agora);
    setFrom(novoFrom);
    setTo(novoTo);
    buscar(novoFrom, novoTo);
  }

  return (
    <div className="space-y-5">
      <Card
        title="Maior e menor cota por período"
        description="Ex.: a maior cota vendida até 20/12 às 18h. Deixe a data inicial vazia para contar desde o começo da rifa."
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            buscar(from, to);
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Input
              label="De (data e hora)"
              type="datetime-local"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              hint="vazio = desde o início"
            />
            <Input
              label="Até (data e hora)"
              type="datetime-local"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              hint="vazio = até agora"
            />
            <Button type="submit" loading={loading}>
              <Search className="size-4" />
              Consultar
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            {ATALHOS.map((atalho) => (
              <button
                key={atalho.label}
                type="button"
                onClick={() => aplicarAtalho(atalho)}
                className="rounded-full border border-ink/10 px-4 py-1.5 text-xs text-ink/60 transition-colors hover:border-gold/50 hover:text-gold cursor-pointer"
              >
                {atalho.label}
              </button>
            ))}
          </div>
        </form>
      </Card>

      <AnimatePresence mode="wait">
        {range && (
          <motion.div
            key={`${range.from}-${range.to}-${range.count}`}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-4"
          >
            <Card>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <span className="flex items-center gap-2 text-ink/55">
                  <CalendarClock className="size-4 text-gold" />
                  {range.from ? formatDateTimeBR(range.from) : "início da rifa"}
                  {" → "}
                  {range.to ? formatDateTimeBR(range.to) : "agora"}
                </span>
                <span className="text-ink/50">
                  <strong className="text-ink">{formatNumber(range.count)}</strong> cota(s)
                </span>
                <span className="text-ink/50">
                  <strong className="text-ink">{range.ordersCount}</strong> pedido(s)
                </span>
                <span className="text-ink/50">
                  cota a <strong className="text-ink">{formatBRL(priceCents)}</strong>
                </span>
                <span className="text-ink/50">
                  total <strong className="text-gold">{formatBRL(range.revenueCents)}</strong>
                </span>
              </div>
            </Card>

            {range.count === 0 ? (
              <Card>
                <div className="py-10 text-center">
                  <Ticket className="mx-auto size-8 text-ink/25" />
                  <p className="mt-3 text-sm text-ink/45">
                    Nenhuma cota foi vendida nesse período.
                  </p>
                </div>
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                <Edge
                  titulo="Maior cota do período"
                  icone={ArrowUpWideNarrow}
                  edge={range.highest}
                  totalNumbers={totalNumbers}
                  priceCents={priceCents}
                  destaque
                />
                <Edge
                  titulo="Menor cota do período"
                  icone={ArrowDownWideNarrow}
                  edge={range.lowest}
                  totalNumbers={totalNumbers}
                  priceCents={priceCents}
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Edge({
  titulo,
  icone: Icone,
  edge,
  totalNumbers,
  priceCents,
  destaque,
}: {
  titulo: string;
  icone: React.ComponentType<{ className?: string }>;
  edge: Range["highest"];
  totalNumbers: number;
  priceCents: number;
  destaque?: boolean;
}) {
  if (!edge) return null;

  return (
    <Card className={destaque ? "border-gold/30 bg-gold/5" : undefined}>
      <div className="flex items-center gap-2">
        <Icone className={destaque ? "size-4 text-gold" : "size-4 text-ink/45"} />
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-ink/50">
          {titulo}
        </h3>
      </div>

      <p
        className={
          destaque
            ? "mt-3 font-mono text-3xl font-bold text-gradient-gold sm:text-4xl"
            : "mt-3 font-mono text-3xl font-bold text-ink sm:text-4xl"
        }
      >
        {padTicket(edge.number, totalNumbers)}
      </p>
      <p className="mt-1 text-xs text-ink/40">
        vendida em {formatDateTimeBR(edge.soldAt)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Dado rotulo="Valor da cota" valor={formatBRL(priceCents)} />
        <Dado rotulo="Cotas no pedido" valor={formatNumber(edge.order.quantity)} />
        <Dado
          rotulo="Total do pedido"
          valor={formatBRL(edge.order.totalCents)}
          destaque={destaque}
        />
      </div>

      <div className="mt-2 space-y-1 rounded-xl border border-ink/10 bg-paper-50 px-4 py-3">
        <p className="font-display text-sm font-700 text-ink">{edge.order.name}</p>
        <p className="text-xs text-ink/55">
          {edge.order.phone} · {edge.order.cpf}
        </p>
        <p className="text-xs text-ink/40">
          Pedido {edge.order.code} ·{" "}
          {edge.order.status === "pago" ? "pago" : edge.order.status}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`tel:+55${onlyDigits(edge.order.phone)}`, "_self")}
        >
          <Phone className="size-4" />
          Ligar
        </Button>
        <Button
          size="sm"
          variant="dark"
          onClick={() => window.open(`https://wa.me/55${onlyDigits(edge.order.phone)}`, "_blank")}
        >
          WhatsApp
        </Button>
      </div>
    </Card>
  );
}

function Dado({
  rotulo,
  valor,
  destaque,
}: {
  rotulo: string;
  valor: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-ink/10 bg-paper-50 px-3 py-2.5">
      <span className="block text-[10px] uppercase tracking-[0.12em] text-ink/40">
        {rotulo}
      </span>
      <p
        className={
          destaque
            ? "mt-0.5 font-display text-sm font-700 text-gold"
            : "mt-0.5 font-display text-sm font-700 text-ink"
        }
      >
        {valor}
      </p>
    </div>
  );
}

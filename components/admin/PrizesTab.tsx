"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, Gift, Plus, Shuffle, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Badge, Card, Input, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateTimeBR, padTicket } from "@/lib/utils";
import type { PrizeWithBuyer } from "@/lib/types";

function toCents(value: string) {
  const n = Number(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

export default function PrizesTab({
  prizes,
  totalNumbers,
  onChange,
}: {
  prizes: PrizeWithBuyer[];
  totalNumbers: number;
  onChange: (prizes: PrizeWithBuyer[]) => void;
}) {
  const toast = useToast();
  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [manualNumber, setManualNumber] = useState("");

  async function call(url: string, init: RequestInit, successMessage?: string) {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível concluir.", "erro");
        return false;
      }
      if (data.prizes) onChange(data.prizes);
      if (successMessage) toast(successMessage);
      return true;
    } catch {
      toast("Falha de conexão.", "erro");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!label.trim()) return;
    const okDone = await call(
      "/api/admin/prizes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, valueCents: toCents(value) }),
      },
      "Prêmio adicionado. Sorteie os números para ativá-lo."
    );
    if (okDone) {
      setLabel("");
      setValue("");
    }
  }

  const pendentes = prizes.filter((p) => p.number === null).length;
  const conquistados = prizes.filter((p) => p.orderId).length;

  return (
    <div className="space-y-5">
      <Card
        title="Cotas premiadas"
        description="Cadastre os prêmios e sorteie quais números vão escondê-los."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              loading={busy}
              onClick={() =>
                call(
                  "/api/admin/prizes/draw",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reshuffle: false }),
                  },
                  "Números sorteados para os prêmios pendentes."
                )
              }
            >
              <Dices className="size-4" />
              Sortear pendentes
            </Button>
            <Button
              variant="dark"
              loading={busy}
              onClick={() => {
                if (
                  !window.confirm(
                    "Redistribuir TODOS os números não conquistados? Os prêmios já ganhos por participantes serão mantidos."
                  )
                )
                  return;
                call(
                  "/api/admin/prizes/draw",
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ reshuffle: true }),
                  },
                  "Números redistribuídos."
                );
              }}
            >
              <Shuffle className="size-4" />
              Re-sortear tudo
            </Button>
          </div>
        }
      >
        <form onSubmit={add} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <Input
            label="Nome do prêmio"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex.: R$ 500 no Pix"
          />
          <Input
            label="Valor (R$)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="500,00"
          />
          <Button type="submit" loading={busy}>
            <Plus className="size-4" />
            Adicionar
          </Button>
        </form>

        {prizes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/45">
            <Badge tone="ouro">{prizes.length} prêmios</Badge>
            <Badge>{conquistados} conquistados</Badge>
            {pendentes > 0 && <Badge tone="erro">{pendentes} sem número sorteado</Badge>}
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {prizes.map((prize) => (
            <motion.div
              key={prize.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-white/10 bg-ink-800/50 p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-start gap-3">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-gold/30 bg-gold/10">
                    <Gift className="size-5 text-gold" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-display text-base font-700 text-white">{prize.label}</p>
                    <p className="text-xs text-white/40">
                      {prize.valueCents > 0 ? formatBRL(prize.valueCents) : "Sem valor definido"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {prize.number === null ? (
                    <Badge tone="erro">Sem número</Badge>
                  ) : (
                    <span className="rounded-xl border border-gold/40 bg-gold/10 px-3 py-1.5 font-mono text-sm font-bold text-gold">
                      {padTicket(prize.number, totalNumbers)}
                    </span>
                  )}
                  {prize.orderId ? (
                    <Badge tone="ouro">Conquistada</Badge>
                  ) : (
                    <Badge>Disponível</Badge>
                  )}
                  {!prize.orderId && (
                    <button
                      onClick={() => {
                        if (!window.confirm(`Excluir o prêmio "${prize.label}"?`)) return;
                        call(`/api/admin/prizes/${prize.id}`, { method: "DELETE" }, "Prêmio excluído.");
                      }}
                      aria-label="Excluir prêmio"
                      className="flex size-9 items-center justify-center rounded-xl border border-white/10 text-white/45 transition-colors hover:border-crimson/50 hover:text-crimson cursor-pointer"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </div>
              </div>

              {prize.orderId ? (
                <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm">
                  <p className="font-semibold text-white">{prize.buyerName}</p>
                  <p className="text-xs text-white/50">
                    {prize.buyerPhone} · Pedido {prize.orderCode} ·{" "}
                    {formatDateTimeBR(prize.claimedAt)}
                  </p>
                </div>
              ) : (
                <div className="mt-4">
                  {editing === prize.id ? (
                    <div className="flex flex-wrap items-end gap-2">
                      <div className="w-40">
                        <Input
                          label="Definir número"
                          type="number"
                          min={1}
                          max={totalNumbers}
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                        />
                      </div>
                      <Button
                        size="sm"
                        loading={busy}
                        onClick={async () => {
                          const done = await call(
                            `/api/admin/prizes/${prize.id}`,
                            {
                              method: "PATCH",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ number: Number(manualNumber) }),
                            },
                            "Número definido."
                          );
                          if (done) setEditing(null);
                        }}
                      >
                        Aplicar
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                        Cancelar
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditing(prize.id);
                        setManualNumber(prize.number ? String(prize.number) : "");
                      }}
                      className="text-xs text-white/40 underline-offset-4 transition-colors hover:text-gold hover:underline cursor-pointer"
                    >
                      Definir número manualmente
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {prizes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-white/10 py-12 text-center">
            <Gift className="mx-auto size-8 text-white/20" />
            <p className="mt-3 text-sm text-white/40">
              Nenhuma cota premiada cadastrada ainda.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

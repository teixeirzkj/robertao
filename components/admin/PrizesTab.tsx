"use client";

/* eslint-disable @next/next/no-img-element */
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Dices, Gift, ImageOff, Pencil, Plus, Shuffle, Trash2, X } from "lucide-react";
import Button from "@/components/ui/Button";
import { Badge, Card, Input, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateTimeBR, padTicket } from "@/lib/utils";
import type { PrizeWithBuyer } from "@/lib/types";

function toCents(value: string) {
  const n = Number(value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function fromCents(cents: number) {
  return cents ? (cents / 100).toFixed(2).replace(".", ",") : "";
}

interface Draft {
  label: string;
  value: string;
  image: string;
  number: string;
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
  const [novo, setNovo] = useState<Draft>({ label: "", value: "", image: "", number: "" });
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>({ label: "", value: "", image: "", number: "" });

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
    if (!novo.label.trim()) {
      toast("Informe o nome do prêmio.", "erro");
      return;
    }
    const done = await call(
      "/api/admin/prizes",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: novo.label,
          valueCents: toCents(novo.value),
          image: novo.image,
        }),
      },
      "Prêmio adicionado. Sorteie os números para ativá-lo."
    );
    if (done) setNovo({ label: "", value: "", image: "", number: "" });
  }

  function startEdit(prize: PrizeWithBuyer) {
    setEditingId(prize.id);
    setDraft({
      label: prize.label,
      value: fromCents(prize.valueCents),
      image: prize.image,
      number: prize.number ? String(prize.number) : "",
    });
  }

  async function saveEdit(prize: PrizeWithBuyer) {
    const payload: Record<string, unknown> = {
      label: draft.label,
      valueCents: toCents(draft.value),
      image: draft.image,
    };
    // A cota só pode mudar enquanto o prêmio não foi conquistado.
    if (!prize.orderId) {
      payload.number = draft.number.trim() === "" ? null : Number(draft.number);
    }
    const done = await call(
      `/api/admin/prizes/${prize.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
      "Prêmio atualizado."
    );
    if (done) setEditingId(null);
  }

  const pendentes = prizes.filter((p) => p.number === null).length;
  const conquistados = prizes.filter((p) => p.orderId).length;
  const totalPremios = prizes.reduce((sum, p) => sum + p.valueCents, 0);

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
        <form onSubmit={add} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-[1fr_170px]">
            <Input
              label="Nome do prêmio"
              value={novo.label}
              onChange={(e) => setNovo({ ...novo, label: e.target.value })}
              placeholder="Ex.: Pix de R$ 100"
            />
            <Input
              label="Valor (R$)"
              value={novo.value}
              onChange={(e) => setNovo({ ...novo, value: e.target.value })}
              placeholder="100,00"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <Input
              label="Imagem (link)"
              value={novo.image}
              onChange={(e) => setNovo({ ...novo, image: e.target.value })}
              placeholder="https://... (opcional)"
            />
            <Button type="submit" loading={busy}>
              <Plus className="size-4" />
              Adicionar
            </Button>
          </div>
        </form>

        {prizes.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge tone="ouro">{prizes.length} prêmios</Badge>
            <Badge>{formatBRL(totalPremios)} em prêmios</Badge>
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
              className="rounded-2xl border border-ink/10 bg-white p-5"
            >
              {editingId === prize.id ? (
                /* ------------------------------------------------ modo edição */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-sm font-700 text-gold">Editando prêmio</h3>
                    <button
                      onClick={() => setEditingId(null)}
                      aria-label="Cancelar edição"
                      className="flex size-8 items-center justify-center rounded-lg border border-ink/10 text-ink/55 transition-colors hover:text-ink cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[1fr_150px]">
                    <Input
                      label="Nome do prêmio"
                      value={draft.label}
                      onChange={(e) => setDraft({ ...draft, label: e.target.value })}
                    />
                    <Input
                      label="Valor (R$)"
                      value={draft.value}
                      onChange={(e) => setDraft({ ...draft, value: e.target.value })}
                      placeholder="100,00"
                    />
                  </div>

                  <div className="flex items-end gap-3">
                    <div className="size-14 shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-paper">
                      {draft.image ? (
                        <img
                          src={draft.image}
                          alt=""
                          className="size-full object-cover"
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
                          }}
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-ink/30">
                          <ImageOff className="size-5" />
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <Input
                        label="Imagem (link)"
                        value={draft.image}
                        onChange={(e) => setDraft({ ...draft, image: e.target.value })}
                        placeholder="https://..."
                      />
                    </div>
                  </div>

                  {prize.orderId ? (
                    <p className="rounded-xl border border-gold/25 bg-gold/5 px-4 py-2.5 text-xs text-ink/60">
                      A cota {padTicket(prize.number!, totalNumbers)} já foi conquistada e não
                      pode mudar de número.
                    </p>
                  ) : (
                    <div className="sm:w-56">
                      <Input
                        label="Número da cota"
                        type="number"
                        min={1}
                        max={totalNumbers}
                        value={draft.number}
                        onChange={(e) => setDraft({ ...draft, number: e.target.value })}
                        placeholder="deixe vazio para sortear"
                        hint={`Entre 1 e ${totalNumbers}`}
                      />
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button size="sm" loading={busy} onClick={() => saveEdit(prize)}>
                      Salvar alterações
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                /* --------------------------------------------- modo visualização */
                <>
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-gold/25 bg-gold/10">
                        {prize.image ? (
                          <img
                            src={prize.image}
                            alt=""
                            className="size-full object-cover"
                            onError={(e) => {
                              (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
                            }}
                          />
                        ) : (
                          <span className="flex size-full items-center justify-center">
                            <Gift className="size-5 text-gold" />
                          </span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-base font-700 text-ink">
                          {prize.label}
                        </p>
                        <p className="text-xs text-ink/45">
                          {prize.valueCents > 0
                            ? formatBRL(prize.valueCents)
                            : "Sem valor definido"}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
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

                      <button
                        onClick={() => startEdit(prize)}
                        aria-label="Editar prêmio"
                        title="Editar"
                        className="flex size-9 items-center justify-center rounded-xl border border-ink/10 text-ink/55 transition-colors hover:border-gold/50 hover:text-gold cursor-pointer"
                      >
                        <Pencil className="size-4" />
                      </button>

                      <button
                        onClick={() => {
                          if (prize.orderId) {
                            toast(
                              "Este prêmio já foi conquistado por um participante e não pode ser excluído.",
                              "erro"
                            );
                            return;
                          }
                          if (!window.confirm(`Excluir o prêmio "${prize.label}"?`)) return;
                          call(
                            `/api/admin/prizes/${prize.id}`,
                            { method: "DELETE" },
                            "Prêmio excluído."
                          );
                        }}
                        aria-label="Excluir prêmio"
                        title="Excluir"
                        className="flex size-9 items-center justify-center rounded-xl border border-ink/10 text-ink/50 transition-colors hover:border-crimson/50 hover:text-crimson cursor-pointer disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {prize.orderId && (
                    <div className="mt-4 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3 text-sm">
                      <p className="font-semibold text-ink">{prize.buyerName}</p>
                      <p className="text-xs text-ink/55">
                        {prize.buyerPhone} · Pedido {prize.orderCode} ·{" "}
                        {formatDateTimeBR(prize.claimedAt)}
                      </p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {prizes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink/10 py-12 text-center">
            <Gift className="mx-auto size-8 text-ink/25" />
            <p className="mt-3 text-sm text-ink/45">Nenhuma cota premiada cadastrada ainda.</p>
          </div>
        )}
      </div>
    </div>
  );
}

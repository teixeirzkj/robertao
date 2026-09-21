"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, Save, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { Card, Input, Select, Textarea, useToast } from "@/components/admin/primitives";
import { formatBRL } from "@/lib/utils";
import type { Raffle } from "@/lib/types";

/** Converte "12,50" ou "R$ 12,50" em centavos. */
function toCents(value: string) {
  const digits = value.replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(digits);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function fromCents(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export default function RaffleTab({
  raffle,
  onSaved,
}: {
  raffle: Raffle;
  onSaved: (raffle: Raffle) => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(raffle);
  const [price, setPrice] = useState(fromCents(raffle.priceCents));
  const [quickPicks, setQuickPicks] = useState(raffle.quickPicks.join(", "));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm(raffle);
    setPrice(fromCents(raffle.priceCents));
    setQuickPicks(raffle.quickPicks.join(", "));
  }, [raffle]);

  function set<K extends keyof Raffle>(key: K, value: Raffle[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        images: form.images.filter((i) => i.trim()),
        priceCents: toCents(price),
        totalNumbers: form.totalNumbers,
        minQuantity: form.minQuantity,
        maxQuantity: form.maxQuantity,
        quickPicks: quickPicks
          .split(/[,\s]+/)
          .map((n) => Number(n))
          .filter((n) => Number.isFinite(n) && n > 0),
        drawDate: form.drawDate,
        status: form.status,
        prizeChance: form.prizeChance,
        reservationMinutes: form.reservationMinutes,
        pixKey: form.pixKey,
        pixName: form.pixName,
        whatsapp: form.whatsapp,
        instagram: form.instagram,
        rules: form.rules,
        grandPrize: form.grandPrize,
      };

      const res = await fetch("/api/admin/raffle", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível salvar.", "erro");
        return;
      }
      onSaved(data.raffle);
      toast("Rifa atualizada com sucesso.");
    } catch {
      toast("Falha de conexão.", "erro");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="space-y-5">
      <Card
        title="Informações da rifa"
        description="Tudo que aparece na página principal."
        action={
          <Button type="submit" loading={saving}>
            <Save className="size-4" />
            Salvar
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="Ex.: Honda Africa Twin 2025 0km"
          />
          <Input
            label="Subtítulo"
            value={form.subtitle}
            onChange={(e) => set("subtitle", e.target.value)}
            placeholder="Chamada curta exibida abaixo do título"
          />
          <Textarea
            label="Descrição"
            rows={5}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Detalhes do prêmio, condições, entrega..."
          />
          <Textarea
            label="Regulamento"
            rows={4}
            value={form.rules}
            onChange={(e) => set("rules", e.target.value)}
            placeholder="Regras do sorteio, prazo de contato, documentação..."
          />
        </div>
      </Card>

      <Card title="Imagens" description="Cole os links das fotos do prêmio (a primeira é a capa).">
        <div className="space-y-3">
          {form.images.map((img, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3"
            >
              <div className="size-12 shrink-0 overflow-hidden rounded-xl border border-white/10 bg-ink-900">
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="size-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.opacity = "0.15";
                    }}
                  />
                ) : null}
              </div>
              <input
                value={img}
                onChange={(e) => {
                  const next = [...form.images];
                  next[i] = e.target.value;
                  set("images", next);
                }}
                placeholder="https://..."
                className="flex-1 rounded-xl border border-white/10 bg-ink-900/70 px-4 py-2.5 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-gold/60"
              />
              <button
                type="button"
                onClick={() => set("images", form.images.filter((_, idx) => idx !== i))}
                aria-label="Remover imagem"
                className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/10 text-white/50 transition-colors hover:border-crimson/50 hover:text-crimson cursor-pointer"
              >
                <Trash2 className="size-4" />
              </button>
            </motion.div>
          ))}

          <Button
            type="button"
            variant="outline"
            onClick={() => set("images", [...form.images, ""])}
            disabled={form.images.length >= 10}
          >
            <ImagePlus className="size-4" />
            Adicionar imagem
          </Button>
        </div>
      </Card>

      <Card title="Cotas e valores">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Valor da cota (R$)"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="5,00"
            hint={`Será salvo como ${formatBRL(toCents(price))}`}
          />
          <Input
            label="Total de cotas"
            type="number"
            min={10}
            value={form.totalNumbers}
            onChange={(e) => set("totalNumbers", Number(e.target.value))}
            hint="Não é possível reduzir abaixo de cotas já vendidas."
          />
          <Input
            label="Mínimo por compra"
            type="number"
            min={1}
            value={form.minQuantity}
            onChange={(e) => set("minQuantity", Number(e.target.value))}
          />
          <Input
            label="Máximo por compra"
            type="number"
            min={1}
            value={form.maxQuantity}
            onChange={(e) => set("maxQuantity", Number(e.target.value))}
          />
          <Input
            label="Atalhos de quantidade"
            value={quickPicks}
            onChange={(e) => setQuickPicks(e.target.value)}
            hint="Separe por vírgula. Ex.: 5, 10, 25, 50, 100, 250"
            className="sm:col-span-1"
          />
          <Input
            label="Dificuldade das cotas premiadas (%)"
            type="number"
            min={0}
            max={100}
            value={form.prizeChance}
            onChange={(e) => set("prizeChance", Number(e.target.value))}
            hint="Chance inicial de liberar uma cota premiada. Sobe até 100% conforme a rifa enche."
          />
          <Input
            label="Reserva do pedido (minutos)"
            type="number"
            min={5}
            max={10080}
            value={form.reservationMinutes}
            onChange={(e) => set("reservationMinutes", Number(e.target.value))}
            hint="Tempo que um pedido pendente segura as cotas antes de liberá-las."
          />
        </div>
      </Card>

      <Card title="Sorteio e status">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Status da rifa"
            value={form.status}
            onChange={(e) => set("status", e.target.value as Raffle["status"])}
            options={[
              { value: "ativa", label: "Ativa — aceitando compras" },
              { value: "pausada", label: "Pausada — vendas suspensas" },
              { value: "encerrada", label: "Encerrada" },
            ]}
          />
          <Input
            label="Data do sorteio (texto livre)"
            value={form.drawDate}
            onChange={(e) => set("drawDate", e.target.value)}
            placeholder="Ex.: 20/12/2026 às 20h"
          />
          <Input
            label="Prêmio principal"
            value={form.grandPrize}
            onChange={(e) => set("grandPrize", e.target.value)}
            placeholder="Ex.: Honda Africa Twin 0km"
            className="sm:col-span-2"
          />
        </div>
      </Card>

      <Card title="Pagamento e contato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Chave Pix"
            value={form.pixKey}
            onChange={(e) => set("pixKey", e.target.value)}
            placeholder="CPF, e-mail, telefone ou aleatória"
          />
          <Input
            label="Nome do favorecido"
            value={form.pixName}
            onChange={(e) => set("pixName", e.target.value)}
            placeholder="Roberto da Silva"
          />
          <Input
            label="WhatsApp"
            value={form.whatsapp}
            onChange={(e) => set("whatsapp", e.target.value)}
            placeholder="5511999999999"
            hint="Com DDI e DDD, apenas números."
          />
          <Input
            label="Instagram"
            value={form.instagram}
            onChange={(e) => set("instagram", e.target.value)}
            placeholder="@robertaorifas"
          />
        </div>
      </Card>

      <div className="sticky bottom-4 z-10 flex justify-end">
        <Button type="submit" size="lg" loading={saving}>
          <Save className="size-4" />
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}

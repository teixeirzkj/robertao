"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Mail, Phone, RotateCcw, Trophy, User } from "lucide-react";
import Button from "@/components/ui/Button";
import Confetti from "@/components/ui/Confetti";
import { Card, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateBR, formatDateTimeBR, onlyDigits, padTicket } from "@/lib/utils";
import type { Order, Raffle } from "@/lib/types";

interface Winner {
  number: number;
  order: Order;
}

export default function DrawTab({
  raffle,
  soldCount,
  onDrawn,
}: {
  raffle: Raffle;
  soldCount: number;
  onDrawn: () => void;
}) {
  const toast = useToast();
  const [winner, setWinner] = useState<Winner | null>(null);
  const [loading, setLoading] = useState(true);
  const [rolling, setRolling] = useState(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    fetch("/api/admin/draw")
      .then((r) => r.json())
      .then((d) => setWinner(d.winner ?? null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Roleta de números enquanto o sorteio acontece.
  useEffect(() => {
    if (!rolling) return;
    const id = setInterval(
      () => setDisplay(Math.floor(Math.random() * raffle.totalNumbers) + 1),
      70
    );
    return () => clearInterval(id);
  }, [rolling, raffle.totalNumbers]);

  async function draw(force: boolean) {
    if (
      force &&
      !window.confirm("Refazer o sorteio do prêmio principal? O resultado atual será substituído.")
    )
      return;

    setRolling(true);
    const startedAt = Date.now();
    try {
      const res = await fetch("/api/admin/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();

      const elapsed = Date.now() - startedAt;
      if (elapsed < 2600) await new Promise((r) => setTimeout(r, 2600 - elapsed));

      if (!res.ok) {
        toast(data?.error ?? "Não foi possível sortear.", "erro");
        return;
      }
      setWinner(data.winner);
      onDrawn();
      toast("Sorteio realizado!");
    } catch {
      toast("Falha de conexão.", "erro");
    } finally {
      setRolling(false);
    }
  }

  async function reset() {
    if (!window.confirm("Limpar o resultado do sorteio final?")) return;
    const res = await fetch("/api/admin/draw", { method: "DELETE" });
    if (!res.ok) {
      toast("Não foi possível limpar.", "erro");
      return;
    }
    setWinner(null);
    onDrawn();
    toast("Resultado removido.");
  }

  return (
    <div className="space-y-5">
      <Card
        title="Sorteio do prêmio principal"
        description={
          raffle.grandPrize
            ? `Prêmio: ${raffle.grandPrize}`
            : "Defina o prêmio principal na aba Rifa."
        }
      >
        <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-ink-900/60 p-10 text-center">
          {winner && !rolling && <Confetti pieces={50} />}

          <AnimatePresence mode="wait">
            {rolling ? (
              <motion.div
                key="rolling"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-3"
              >
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold">Sorteando...</p>
                <p className="font-mono text-5xl font-bold text-gradient-gold sm:text-6xl">
                  {padTicket(display, raffle.totalNumbers)}
                </p>
              </motion.div>
            ) : winner ? (
              <motion.div
                key="winner"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="relative space-y-3"
              >
                <Trophy className="mx-auto size-10 text-gold" />
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold">
                  Cota vencedora
                </p>
                <p className="font-mono text-5xl font-bold text-gradient-gold sm:text-6xl">
                  {padTicket(winner.number, raffle.totalNumbers)}
                </p>
                <p className="font-display text-xl font-800 text-white">{winner.order.name}</p>
                {raffle.drawnAt && (
                  <p className="text-xs text-white/40">
                    Sorteado em {formatDateTimeBR(raffle.drawnAt)}
                  </p>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="idle"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-3"
              >
                <Trophy className="mx-auto size-10 text-white/20" />
                <p className="text-sm text-white/45">
                  {loading
                    ? "Carregando..."
                    : soldCount > 0
                      ? `${soldCount} cota(s) vendida(s) concorrendo ao prêmio principal.`
                      : "Nenhuma cota vendida ainda."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {!winner ? (
            <Button
              size="lg"
              loading={rolling}
              disabled={soldCount === 0}
              onClick={() => draw(false)}
            >
              <Trophy className="size-4" />
              Sortear prêmio principal
            </Button>
          ) : (
            <>
              <Button variant="dark" loading={rolling} onClick={() => draw(true)}>
                <RotateCcw className="size-4" />
                Refazer sorteio
              </Button>
              <Button variant="ghost" onClick={reset}>
                Limpar resultado
              </Button>
            </>
          )}
        </div>
      </Card>

      {winner && (
        <Card title="Dados do ganhador">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail icon={User} label="Nome" value={winner.order.name} />
              <Detail icon={Phone} label="Telefone" value={winner.order.phone} />
              <Detail icon={Mail} label="E-mail" value={winner.order.email} />
              <Detail icon={User} label="CPF" value={winner.order.cpf} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Detail
                icon={User}
                label="Nascimento"
                value={formatDateBR(winner.order.birthdate)}
              />
              <Detail icon={User} label="Pedido" value={winner.order.code} />
              <Detail
                icon={User}
                label="Cotas compradas"
                value={String(winner.order.quantity)}
              />
              <Detail
                icon={User}
                label="Valor pago"
                value={formatBRL(winner.order.totalCents)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => window.open(`tel:+55${onlyDigits(winner.order.phone)}`, "_self")}
              >
                <Phone className="size-4" />
                Ligar para o ganhador
              </Button>
              <Button
                variant="dark"
                onClick={() =>
                  window.open(`https://wa.me/55${onlyDigits(winner.order.phone)}`, "_blank")
                }
              >
                Abrir WhatsApp
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function Detail({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-ink-900/50 px-4 py-3">
      <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.15em] text-white/35">
        <Icon className="size-3" />
        {label}
      </span>
      <p className="mt-1 truncate text-sm text-white/85">{value}</p>
    </div>
  );
}

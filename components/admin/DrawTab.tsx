"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Mail,
  Phone,
  Search,
  Ticket,
  Trophy,
  User,
  XCircle,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Confetti from "@/components/ui/Confetti";
import { Badge, Card, Detail, Input, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateBR, formatDateTimeBR, onlyDigits, padTicket } from "@/lib/utils";
import type { Order, Raffle } from "@/lib/types";

interface Winner {
  number: number;
  order: Order;
}

interface Busca {
  number: number;
  status: "vendida" | "disponivel";
  order: Order | null;
}

/**
 * O sorteio do prêmio principal é feito pela Loteria Federal. Aqui o admin
 * busca a cota sorteada e a registra como vencedora — o site passa a mostrar
 * o titular e o número.
 */
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
  const [carregando, setCarregando] = useState(true);
  const [numero, setNumero] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [busca, setBusca] = useState<Busca | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    fetch("/api/admin/draw")
      .then((r) => r.json())
      .then((d) => setWinner(d.winner ?? null))
      .catch(() => {})
      .finally(() => setCarregando(false));
  }, []);

  async function buscar(e: React.FormEvent) {
    e.preventDefault();
    const n = onlyDigits(numero);
    if (!n) return;
    setBuscando(true);
    setErro(null);
    setBusca(null);
    try {
      const res = await fetch(`/api/admin/tickets?number=${n}`);
      const data = await res.json();
      if (!res.ok) {
        setErro(data?.error ?? "Não foi possível buscar a cota.");
        return;
      }
      setBusca({ number: data.number, status: data.status, order: data.order });
    } catch {
      setErro("Falha de conexão.");
    } finally {
      setBuscando(false);
    }
  }

  async function registrar() {
    if (!busca?.order) return;
    if (
      winner &&
      !window.confirm(
        `Já existe a cota ${padTicket(winner.number, raffle.totalNumbers)} registrada como ` +
          `vencedora. Substituir pela cota ${padTicket(busca.number, raffle.totalNumbers)}?`
      )
    )
      return;

    setSalvando(true);
    try {
      const res = await fetch("/api/admin/draw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: busca.number, force: Boolean(winner) }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data?.error ?? "Não foi possível registrar.", "erro");
        return;
      }
      setWinner(data.winner);
      setBusca(null);
      setNumero("");
      onDrawn();
      toast("Cota vencedora registrada — já aparece no site.");
    } catch {
      toast("Falha de conexão.", "erro");
    } finally {
      setSalvando(false);
    }
  }

  async function limpar() {
    if (!window.confirm("Remover a cota vencedora? O site volta a não mostrar ganhador.")) return;
    const res = await fetch("/api/admin/draw", { method: "DELETE" });
    if (!res.ok) {
      toast("Não foi possível remover.", "erro");
      return;
    }
    setWinner(null);
    onDrawn();
    toast("Resultado removido.");
  }

  return (
    <div className="space-y-5">
      {/* ----------------------------------------------- resultado registrado */}
      <Card
        title="Cota vencedora"
        description={
          raffle.grandPrize
            ? `Prêmio principal: ${raffle.grandPrize}. O sorteio é feito pela Loteria Federal — informe aqui a cota sorteada.`
            : "Defina o prêmio principal na aba Rifa. O sorteio é feito pela Loteria Federal."
        }
      >
        <div className="relative overflow-hidden rounded-2xl border border-ink/10 bg-paper-50 p-6 text-center sm:p-10">
          {winner && <Confetti pieces={40} />}

          <AnimatePresence mode="wait">
            {winner ? (
              <motion.div
                key="winner"
                initial={{ opacity: 0, scale: 0.93 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 220, damping: 18 }}
                className="relative space-y-3"
              >
                <Trophy className="mx-auto size-10 text-gold" />
                <p className="text-[11px] uppercase tracking-[0.25em] text-gold">
                  Cota vencedora
                </p>
                <p className="font-mono text-4xl font-bold text-gradient-gold sm:text-6xl">
                  {padTicket(winner.number, raffle.totalNumbers)}
                </p>
                <p className="font-display text-xl font-800 text-ink">{winner.order.name}</p>
                {raffle.drawnAt && (
                  <p className="text-xs text-ink/45">
                    Registrada em {formatDateTimeBR(raffle.drawnAt)}
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
                <Trophy className="mx-auto size-10 text-ink/25" />
                <p className="text-sm text-ink/50">
                  {carregando
                    ? "Carregando..."
                    : soldCount > 0
                      ? `Nenhuma cota vencedora registrada. ${soldCount} cota(s) vendida(s) concorrendo.`
                      : "Nenhuma cota vendida ainda."}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {winner && (
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="ghost" onClick={limpar}>
              <XCircle className="size-4" />
              Remover resultado
            </Button>
          </div>
        )}
      </Card>

      {/* ------------------------------------------------------- buscar a cota */}
      <Card
        title={winner ? "Trocar a cota vencedora" : "Registrar a cota sorteada"}
        description="Digite o número sorteado na Federal para ver o titular antes de confirmar."
      >
        <form onSubmit={buscar} className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              label="Número da cota sorteada"
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              inputMode="numeric"
              placeholder={`1 a ${raffle.totalNumbers}`}
              className="font-mono text-lg"
            />
          </div>
          <Button type="submit" loading={buscando}>
            <Search className="size-4" />
            Buscar
          </Button>
        </form>

        <AnimatePresence mode="wait">
          {erro && (
            <motion.p
              key="erro"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-4 flex items-start gap-2 rounded-xl border border-crimson/40 bg-crimson/5 px-4 py-3 text-sm text-crimson"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              {erro}
            </motion.p>
          )}

          {busca && (
            <motion.div
              key={busca.number}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
              className="mt-5 space-y-4"
            >
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gold/30 bg-gold/5 p-4">
                <span className="rounded-xl border border-gold/40 bg-paper-100 px-4 py-2 font-mono text-2xl font-bold text-gradient-gold">
                  {padTicket(busca.number, raffle.totalNumbers)}
                </span>
                {busca.order ? (
                  <Badge tone="ouro">Cota vendida</Badge>
                ) : (
                  <Badge tone="erro">Cota não vendida</Badge>
                )}
                {busca.order?.status === "pendente" && (
                  <Badge tone="erro">Pagamento pendente</Badge>
                )}
              </div>

              {busca.order ? (
                <>
                  <div>
                    <p className="font-display text-xl font-800 text-ink">{busca.order.name}</p>
                    <p className="text-xs text-ink/45">
                      Pedido {busca.order.code} · {busca.order.quantity} cota(s) ·{" "}
                      {formatBRL(busca.order.totalCents)} ·{" "}
                      {busca.order.status === "pago" ? "pago" : busca.order.status}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
                    <Detail icon={Phone} label="Telefone" value={busca.order.phone} />
                    <Detail icon={Mail} label="E-mail" value={busca.order.email} multiline />
                    <Detail icon={User} label="CPF" value={busca.order.cpf} />
                    <Detail
                      icon={User}
                      label="Nascimento"
                      value={formatDateBR(busca.order.birthdate)}
                    />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button loading={salvando} onClick={registrar}>
                      <Trophy className="size-4" />
                      Definir como cota vencedora
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() =>
                        window.open(`tel:+55${onlyDigits(busca.order!.phone)}`, "_self")
                      }
                    >
                      <Phone className="size-4" />
                      Ligar
                    </Button>
                    <Button
                      variant="dark"
                      onClick={() =>
                        window.open(`https://wa.me/55${onlyDigits(busca.order!.phone)}`, "_blank")
                      }
                    >
                      WhatsApp
                    </Button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-dashed border-ink/15 bg-paper-50 px-4 py-6 text-center">
                  <Ticket className="mx-auto size-7 text-ink/25" />
                  <p className="mt-2 text-sm text-ink/55">
                    Esta cota não foi vendida, então não há titular para registrar. Siga a regra
                    do regulamento para chegar à próxima cota válida.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </div>
  );
}

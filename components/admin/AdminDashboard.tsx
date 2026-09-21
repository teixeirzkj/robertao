"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Gift,
  LayoutDashboard,
  ListOrdered,
  Loader2,
  LogOut,
  Search,
  Settings2,
  Ticket,
  Timer,
  Trophy,
  Users,
} from "lucide-react";
import Button from "@/components/ui/Button";
import ProgressBar from "@/components/ui/ProgressBar";
import { Card, StatCard, ToastProvider, useToast } from "@/components/admin/primitives";
import RaffleTab from "@/components/admin/RaffleTab";
import PrizesTab from "@/components/admin/PrizesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import TicketSearchTab from "@/components/admin/TicketSearchTab";
import DrawTab from "@/components/admin/DrawTab";
import { formatBRL, formatNumber } from "@/lib/utils";
import type { PrizeWithBuyer, Raffle, RaffleStats } from "@/lib/types";

type TabId = "visao" | "rifa" | "premiadas" | "pedidos" | "cotas" | "sorteio";

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "visao", label: "Visão geral", icon: LayoutDashboard },
  { id: "rifa", label: "Rifa", icon: Settings2 },
  { id: "premiadas", label: "Cotas premiadas", icon: Gift },
  { id: "pedidos", label: "Pedidos", icon: ListOrdered },
  { id: "cotas", label: "Cotas", icon: Search },
  { id: "sorteio", label: "Cota vencedora", icon: Trophy },
];

export default function AdminDashboard() {
  return (
    <ToastProvider>
      <Dashboard />
    </ToastProvider>
  );
}

function Dashboard() {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("visao");
  const [raffle, setRaffle] = useState<Raffle | null>(null);
  const [stats, setStats] = useState<RaffleStats | null>(null);
  const [prizes, setPrizes] = useState<PrizeWithBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [menuAberto, setMenuAberto] = useState(false);

  const load = useCallback(async () => {
    try {
      const [raffleRes, prizesRes] = await Promise.all([
        fetch("/api/admin/raffle"),
        fetch("/api/admin/prizes"),
      ]);

      if (raffleRes.status === 401) {
        router.refresh();
        return;
      }

      const raffleData = await raffleRes.json();
      if (!raffleRes.ok) {
        toast(raffleData?.error ?? "Erro ao carregar dados.", "erro");
        return;
      }
      setRaffle(raffleData.raffle);
      setStats(raffleData.stats);

      const prizesData = await prizesRes.json();
      if (prizesRes.ok) setPrizes(prizesData.prizes);
    } catch {
      toast("Falha de conexão com o servidor.", "erro");
    } finally {
      setLoading(false);
    }
  }, [router, toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/admin/session", { method: "DELETE" });
    router.refresh();
  }

  const AbaAtual = TABS.find((t) => t.id === tab)?.icon ?? LayoutDashboard;

  if (loading || !raffle || !stats) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-7 animate-spin text-gold" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-40 border-b border-ink/8 bg-paper/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <span className="font-display text-base font-800">
              <span className="text-gradient-gold">ROBERTÃO</span>{" "}
              <span className="text-ink">ADMIN</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/"
              target="_blank"
              className="hidden items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-xs text-ink/65 transition-colors hover:border-gold/50 hover:text-gold sm:flex"
            >
              <ExternalLink className="size-3.5" />
              Ver site
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-2 rounded-full border border-ink/10 px-4 py-2 text-xs text-ink/65 transition-colors hover:border-crimson/50 hover:text-crimson cursor-pointer"
            >
              <LogOut className="size-3.5" />
              Sair
            </button>
          </div>
        </div>

        {/* celular: menu suspenso com a secao atual */}
        <div className="px-5 pb-3 lg:hidden">
          <button
            onClick={() => setMenuAberto((v) => !v)}
            aria-expanded={menuAberto}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-gold/40 bg-gold/5 px-4 py-3 text-left cursor-pointer"
          >
            <span className="flex items-center gap-2.5 text-sm font-semibold text-gold">
              <AbaAtual className="size-4" />
              {TABS.find((t) => t.id === tab)?.label}
            </span>
            <ChevronDown
              className={`size-4 shrink-0 text-gold transition-transform ${
                menuAberto ? "rotate-180" : ""
              }`}
            />
          </button>

          <AnimatePresence initial={false}>
            {menuAberto && (
              <motion.nav
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="mt-2 grid gap-1 rounded-xl border border-ink/10 bg-white p-2 shadow-card">
                  {TABS.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTab(item.id);
                        setMenuAberto(false);
                      }}
                      className={`flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors cursor-pointer ${
                        tab === item.id
                          ? "bg-gold/10 font-semibold text-gold"
                          : "text-ink/70 hover:bg-ink/5 hover:text-ink"
                      }`}
                    >
                      <item.icon className="size-4 shrink-0" />
                      {item.label}
                    </button>
                  ))}
                </div>
              </motion.nav>
            )}
          </AnimatePresence>
        </div>

        {/* telas maiores: barra de abas */}
        <nav className="mx-auto hidden max-w-6xl gap-1 overflow-x-auto px-5 pb-3 lg:flex lg:px-8">
          {TABS.map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              className={`relative flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm transition-colors cursor-pointer ${
                tab === item.id ? "text-gold" : "text-ink/55 hover:text-ink"
              }`}
            >
              {tab === item.id && (
                <motion.span
                  layoutId="admin-tab"
                  className="absolute inset-0 rounded-xl border border-gold/40 bg-gold/10"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <item.icon className="relative size-4" />
              <span className="relative whitespace-nowrap">{item.label}</span>
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-8 lg:px-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === "visao" && (
              <Overview raffle={raffle} stats={stats} prizes={prizes} onGo={setTab} />
            )}

            {tab === "rifa" && (
              <RaffleTab
                raffle={raffle}
                onSaved={(next) => {
                  setRaffle(next);
                  load();
                }}
              />
            )}

            {tab === "premiadas" && (
              <PrizesTab
                prizes={prizes}
                totalNumbers={raffle.totalNumbers}
                onChange={(next) => {
                  setPrizes(next);
                  load();
                }}
              />
            )}

            {tab === "pedidos" && <OrdersTab totalNumbers={raffle.totalNumbers} />}

            {tab === "cotas" && (
              <TicketSearchTab
                totalNumbers={raffle.totalNumbers}
                priceCents={raffle.priceCents}
              />
            )}

            {tab === "sorteio" && (
              <DrawTab raffle={raffle} soldCount={stats.sold} onDrawn={load} />
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

function Overview({
  raffle,
  stats,
  prizes,
  onGo,
}: {
  raffle: Raffle;
  stats: RaffleStats;
  prizes: PrizeWithBuyer[];
  onGo: (tab: TabId) => void;
}) {
  const semNumero = prizes.filter((p) => p.number === null).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Cotas vendidas"
          value={formatNumber(stats.sold)}
          hint={`de ${formatNumber(raffle.totalNumbers)} · ${stats.soldPercent.toFixed(1)}%`}
          icon={Ticket}
          accent
        />
        <StatCard
          label="Arrecadado"
          value={formatBRL(stats.paidRevenueCents)}
          hint={`${formatBRL(stats.revenueCents)} incluindo pendentes`}
          icon={DollarSign}
        />
        <StatCard
          label="Pedidos pagos"
          value={formatNumber(stats.paidCount)}
          hint={`${stats.ordersCount} pedidos no total`}
          icon={Users}
        />
        <StatCard
          label="Cotas premiadas"
          value={`${stats.prizesClaimed}/${stats.prizesTotal}`}
          hint="conquistadas pelos participantes"
          icon={Gift}
        />
      </div>

      {stats.pendingCount > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-ink/12 bg-ink/5">
                <Timer className="size-5 text-ink/65" />
              </div>
              <div>
                <p className="font-display text-sm font-700 text-ink">
                  {stats.pendingCount} pedido(s) aguardando pagamento
                </p>
                <p className="text-xs text-ink/50">
                  {formatNumber(stats.reserved)} cota(s) reservadas por até{" "}
                  {raffle.reservationMinutes} min. Os números só são sorteados quando você
                  confirma o pagamento.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => onGo("pedidos")}>
              Ver pendentes
            </Button>
          </div>
        </Card>
      )}

      <Card title="Progresso da rifa" description={raffle.title}>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-ink/60">
              {formatNumber(stats.sold)} vendidas · {formatNumber(stats.available)} disponíveis
            </span>
            <span className="font-display text-lg font-800 text-gradient-gold">
              {stats.soldPercent.toFixed(1)}%
            </span>
          </div>
          <ProgressBar percent={Math.min(stats.soldPercent, 100)} />
          <div className="flex flex-wrap gap-2 pt-2 text-xs text-ink/45">
            <span className="rounded-full border border-ink/10 px-3 py-1">
              Valor da cota: {formatBRL(raffle.priceCents)}
            </span>
            <span className="rounded-full border border-ink/10 px-3 py-1">
              Reservadas: {formatNumber(stats.reserved)}
            </span>
            <span className="rounded-full border border-ink/10 px-3 py-1">
              Livres: {formatNumber(stats.available)}
            </span>
            <span className="rounded-full border border-ink/10 px-3 py-1">
              Status: {raffle.status}
            </span>
            {raffle.drawDate && (
              <span className="rounded-full border border-ink/10 px-3 py-1">
                Sorteio: {raffle.drawDate}
              </span>
            )}
          </div>
        </div>
      </Card>

      {semNumero > 0 && (
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-xl border border-crimson/40 bg-crimson/10">
                <Gift className="size-5 text-crimson" />
              </div>
              <div>
                <p className="font-display text-sm font-700 text-ink">
                  {semNumero} prêmio(s) sem número sorteado
                </p>
                <p className="text-xs text-ink/50">
                  Eles só entram em jogo depois do sorteio dos números.
                </p>
              </div>
            </div>
            <Button variant="outline" onClick={() => onGo("premiadas")}>
              Sortear agora
            </Button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { id: "cotas" as TabId, icon: Search, title: "Cotas", text: "Buscar titular por número e ver maior/menor cota por período." },
          { id: "pedidos" as TabId, icon: ListOrdered, title: "Pedidos", text: "Lista completa com dados dos compradores." },
          { id: "sorteio" as TabId, icon: Trophy, title: "Cota vencedora", text: "Registrar a cota sorteada na Federal e mostrar o ganhador." },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => onGo(item.id)}
            className="rounded-2xl border border-ink/10 bg-white p-5 text-left transition-colors hover:border-gold/40 cursor-pointer"
          >
            <item.icon className="size-5 text-gold" />
            <p className="mt-3 font-display text-sm font-700 text-ink">{item.title}</p>
            <p className="mt-1 text-xs text-ink/50">{item.text}</p>
          </button>
        ))}
      </div>
    </div>
  );
}

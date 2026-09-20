"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Gift,
  Loader2,
  Mail,
  Phone,
  Search,
  Trash2,
  User,
  X,
} from "lucide-react";
import Button from "@/components/ui/Button";
import { Badge, Card, useToast } from "@/components/admin/primitives";
import { formatBRL, formatDateBR, formatDateTimeBR, padTicket } from "@/lib/utils";
import type { OrderWithNumbers } from "@/lib/types";

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendentes" },
  { value: "pago", label: "Pagos" },
  { value: "cancelado", label: "Cancelados" },
];

export default function OrdersTab({ totalNumbers }: { totalNumbers: number }) {
  const toast = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("todos");
  const [orders, setOrders] = useState<OrderWithNumbers[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(
    async (term: string, statusValue: string, pageIndex: number) => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: term,
          status: statusValue,
          limit: String(PAGE_SIZE),
          offset: String(pageIndex * PAGE_SIZE),
        });
        const res = await fetch(`/api/admin/orders?${params}`);
        const data = await res.json();
        if (!res.ok) {
          toast(data?.error ?? "Erro ao carregar pedidos.", "erro");
          return;
        }
        setOrders(data.orders);
        setTotal(data.total);
      } catch {
        toast("Falha de conexão.", "erro");
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    const id = setTimeout(() => load(search, status, page), search ? 350 : 0);
    return () => clearTimeout(id);
  }, [search, status, page, load]);

  async function changeStatus(id: string, next: string) {
    const res = await fetch(`/api/admin/orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data?.error ?? "Não foi possível atualizar.", "erro");
      return;
    }
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: next as OrderWithNumbers["status"] } : o))
    );
    toast(next === "pago" ? "Pagamento confirmado." : "Status atualizado.");
  }

  async function remove(order: OrderWithNumbers) {
    if (
      !window.confirm(
        `Excluir o pedido ${order.code} de ${order.name}? As ${order.quantity} cota(s) voltam a ficar disponíveis.`
      )
    )
      return;
    const res = await fetch(`/api/admin/orders/${order.id}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast(data?.error ?? "Não foi possível excluir.", "erro");
      return;
    }
    toast("Pedido excluído e cotas liberadas.");
    load(search, status, page);
  }

  const pages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      <Card title="Pedidos" description="Todas as compras, com os números adquiridos.">
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-white/30" />
            <input
              value={search}
              onChange={(e) => {
                setPage(0);
                setSearch(e.target.value);
              }}
              placeholder="Buscar por nome, CPF, telefone, e-mail, código ou número da cota"
              className="w-full rounded-xl border border-white/10 bg-ink-900/70 py-3 pl-11 pr-4 text-sm text-white outline-none transition-colors placeholder:text-white/25 focus:border-gold/60"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setPage(0);
                  setStatus(tab.value);
                }}
                className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                  status === tab.value
                    ? "border-gold/60 bg-gold/10 text-gold"
                    : "border-white/10 text-white/50 hover:border-white/25"
                }`}
              >
                {tab.label}
              </button>
            ))}
            <span className="ml-auto self-center text-xs text-white/35">
              {total} resultado(s)
            </span>
          </div>
        </div>
      </Card>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="size-6 animate-spin text-gold" />
        </div>
      ) : orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 py-16 text-center">
          <User className="mx-auto size-8 text-white/20" />
          <p className="mt-3 text-sm text-white/40">Nenhum pedido encontrado.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="overflow-hidden rounded-2xl border border-white/10 bg-ink-800/50"
            >
              <button
                onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                className="flex w-full flex-wrap items-center justify-between gap-3 p-5 text-left cursor-pointer"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-display text-base font-700 text-white">{order.name}</p>
                    {order.prizes.length > 0 && (
                      <Badge tone="ouro">
                        <Gift className="size-3" />
                        {order.prizes.length} premiada(s)
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/40">
                    {order.code} · {order.quantity} cota(s) · {formatBRL(order.totalCents)} ·{" "}
                    {formatDateTimeBR(order.createdAt)}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {order.status === "pago" && <Badge tone="ouro">Pago</Badge>}
                  {order.status === "pendente" && <Badge>Pendente</Badge>}
                  {order.status === "cancelado" && <Badge tone="erro">Cancelado</Badge>}
                  <ChevronDown
                    className={`size-4 text-white/35 transition-transform ${
                      expanded === order.id ? "rotate-180" : ""
                    }`}
                  />
                </div>
              </button>

              <AnimatePresence initial={false}>
                {expanded === order.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                    className="overflow-hidden border-t border-white/5"
                  >
                    <div className="space-y-5 p-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <Detail icon={Phone} label="Telefone" value={order.phone} />
                        <Detail icon={Mail} label="E-mail" value={order.email} />
                        <Detail icon={User} label="CPF" value={order.cpf} />
                        <Detail
                          icon={User}
                          label="Nascimento"
                          value={formatDateBR(order.birthdate)}
                        />
                      </div>

                      {order.prizes.length > 0 && (
                        <div className="space-y-2">
                          {order.prizes.map((prize) => (
                            <div
                              key={prize.id}
                              className="flex items-center gap-3 rounded-xl border border-gold/35 bg-gold/10 px-4 py-3"
                            >
                              <Gift className="size-4 shrink-0 text-gold" />
                              <span className="text-sm font-semibold text-gold">
                                {prize.label}
                              </span>
                              <span className="ml-auto font-mono text-xs text-white/60">
                                {padTicket(prize.number, totalNumbers)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <p className="mb-2 text-[11px] uppercase tracking-[0.15em] text-white/40">
                          Cotas adquiridas ({order.numbers.length})
                        </p>
                        <div className="flex max-h-52 flex-wrap gap-1.5 overflow-y-auto">
                          {order.numbers.map((n) => {
                            const isPrize = order.prizes.some((p) => p.number === n);
                            return (
                              <span
                                key={n}
                                className={
                                  isPrize
                                    ? "rounded-lg bg-gold-metal bg-[length:200%_auto] px-2.5 py-1.5 font-mono text-xs font-bold text-ink-900"
                                    : "rounded-lg border border-white/10 bg-ink-700 px-2.5 py-1.5 font-mono text-xs text-white/75"
                                }
                              >
                                {padTicket(n, totalNumbers)}
                              </span>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {order.status !== "pago" && (
                          <Button size="sm" onClick={() => changeStatus(order.id, "pago")}>
                            <Check className="size-4" />
                            Confirmar pagamento
                          </Button>
                        )}
                        {order.status !== "pendente" && (
                          <Button
                            size="sm"
                            variant="dark"
                            onClick={() => changeStatus(order.id, "pendente")}
                          >
                            Marcar como pendente
                          </Button>
                        )}
                        {order.status !== "cancelado" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => changeStatus(order.id, "cancelado")}
                          >
                            <X className="size-4" />
                            Cancelar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-crimson hover:bg-crimson/10"
                          onClick={() => remove(order)}
                        >
                          <Trash2 className="size-4" />
                          Excluir e liberar cotas
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <Button
            size="sm"
            variant="dark"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(p - 1, 0))}
          >
            Anterior
          </Button>
          <span className="text-xs text-white/40">
            Página {page + 1} de {pages}
          </span>
          <Button
            size="sm"
            variant="dark"
            disabled={page + 1 >= pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Próxima
          </Button>
        </div>
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

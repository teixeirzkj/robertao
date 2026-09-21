export type RaffleStatus = "ativa" | "pausada" | "encerrada";
export type OrderStatus = "pendente" | "pago" | "cancelado";

export interface Raffle {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  images: string[];
  priceCents: number;
  totalNumbers: number;
  minQuantity: number;
  maxQuantity: number;
  quickPicks: number[];
  drawDate: string;
  status: RaffleStatus;
  /** Chance base (%) de uma cota premiada sair em um sorteio de números. */
  prizeChance: number;
  /** Por quantos minutos um pedido pendente segura as cotas reservadas. */
  reservationMinutes: number;
  pixKey: string;
  pixName: string;
  /** InfiniteTag da InfinitePay (sem o $) usada no link de pagamento. */
  infinitepayHandle: string;
  whatsapp: string;
  /** Convite do grupo de WhatsApp. */
  whatsappGroup: string;
  instagram: string;
  rules: string;
  grandPrize: string;
  winnerNumber: number | null;
  winnerOrderId: string | null;
  drawnAt: string | null;
}

export interface RaffleStats {
  sold: number;
  /** Cotas presas em pedidos pendentes dentro da janela de reserva. */
  reserved: number;
  available: number;
  soldPercent: number;
  ordersCount: number;
  pendingCount: number;
  paidCount: number;
  revenueCents: number;
  paidRevenueCents: number;
  prizesTotal: number;
  prizesClaimed: number;
}

export interface Prize {
  id: number;
  label: string;
  valueCents: number;
  image: string;
  number: number | null;
  orderId: string | null;
  claimedAt: string | null;
}

export interface PrizeWithBuyer extends Prize {
  buyerName: string | null;
  buyerPhone: string | null;
  orderCode: string | null;
}

/** Prêmio conquistado dentro de um pedido. */
export interface WonPrize {
  id: number;
  label: string;
  valueCents: number;
  image: string;
  number: number;
}

export interface Order {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string;
  cpf: string;
  birthdate: string;
  quantity: number;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
}

export interface OrderWithNumbers extends Order {
  /** Vazio enquanto o pagamento não é confirmado. */
  numbers: number[];
  prizes: WonPrize[];
}

export interface PublicRaffle extends Raffle {
  stats: Pick<RaffleStats, "sold" | "soldPercent">;
  prizes: {
    id: number;
    label: string;
    valueCents: number;
    image: string;
    /** Null enquanto o numero nao foi sorteado no painel. */
    number: number | null;
    claimed: boolean;
    /** Nome mascarado de quem conquistou, ou null. */
    winner: string | null;
  }[];
}

/** Dados que o comprador vê na página do pedido, sem expor CPF/e-mail completos. */
export interface PublicOrder {
  code: string;
  name: string;
  quantity: number;
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
  paidAt: string | null;
  numbers: number[];
  prizes: WonPrize[];
  expiresAt: string | null;
}

/** Resultado da consulta de maior/menor cota em um período. */
export interface TicketRange {
  from: string | null;
  to: string | null;
  count: number;
  ordersCount: number;
  revenueCents: number;
  lowest: { number: number; soldAt: string; order: Order } | null;
  highest: { number: number; soldAt: string; order: Order } | null;
}

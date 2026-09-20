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
  pixKey: string;
  pixName: string;
  whatsapp: string;
  instagram: string;
  rules: string;
  grandPrize: string;
  winnerNumber: number | null;
  winnerOrderId: string | null;
  drawnAt: string | null;
}

export interface RaffleStats {
  sold: number;
  available: number;
  soldPercent: number;
  ordersCount: number;
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
  number: number | null;
  orderId: string | null;
  claimedAt: string | null;
}

export interface PrizeWithBuyer extends Prize {
  buyerName: string | null;
  buyerPhone: string | null;
  orderCode: string | null;
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
  numbers: number[];
  prizes: { id: number; label: string; valueCents: number; number: number }[];
}

export interface PublicRaffle extends Raffle {
  stats: Pick<RaffleStats, "sold" | "available" | "soldPercent">;
  prizes: { id: number; label: string; valueCents: number; claimed: boolean }[];
}

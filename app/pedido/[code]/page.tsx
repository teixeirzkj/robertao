import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SiteHeader, { WhatsAppFloating } from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import OrderStatus from "@/components/site/OrderStatus";
import SetupNotice from "@/components/site/SetupNotice";
import { getPublicOrder, getPublicRaffle } from "@/lib/raffle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Seu pedido | Robertão Premiações",
  robots: { index: false, follow: false },
};

type Props = { params: Promise<{ code: string }> };

export default async function OrderPage({ params }: Props) {
  const { code } = await params;

  let raffle;
  let order;
  try {
    [raffle, order] = await Promise.all([getPublicRaffle(), getPublicOrder(code)]);
  } catch (err) {
    return (
      <SetupNotice
        message={err instanceof Error ? err.message : "Não foi possível conectar ao banco."}
      />
    );
  }

  if (!order) notFound();

  return (
    <>
      <SiteHeader
        instagram={raffle.instagram}
        whatsapp={raffle.whatsapp}
        whatsappGroup={raffle.whatsappGroup}
      />
      <main className="min-h-screen">
        <OrderStatus order={order} raffle={raffle} />
      </main>
      <SiteFooter whatsapp={raffle.whatsapp} instagram={raffle.instagram} />
      <WhatsAppFloating phone={raffle.whatsapp} group={raffle.whatsappGroup} />
    </>
  );
}

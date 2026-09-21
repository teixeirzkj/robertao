import type { Metadata } from "next";
import SiteHeader, { WhatsAppFloating } from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import RaffleView from "@/components/site/RaffleView";
import SetupNotice from "@/components/site/SetupNotice";
import { getGrandWinner, getPublicRaffle } from "@/lib/raffle";
import { maskName } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const raffle = await getPublicRaffle();
    return {
      title: `${raffle.title} | Robertão Premiações`,
      description: raffle.subtitle || raffle.description.slice(0, 160),
      // As imagens vem de app/opengraph-image.png (convencao do Next).
      openGraph: {
        title: raffle.title,
        description: raffle.subtitle,
      },
    };
  } catch {
    return { title: "Robertão Premiações" };
  }
}

export default async function HomePage() {
  let raffle;
  let winner = null;

  try {
    [raffle, winner] = await Promise.all([getPublicRaffle(), getGrandWinner()]);
  } catch (err) {
    return (
      <SetupNotice
        message={
          err instanceof Error ? err.message : "Não foi possível conectar ao banco de dados."
        }
      />
    );
  }

  return (
    <>
      <SiteHeader
        instagram={raffle.instagram}
        whatsapp={raffle.whatsapp}
        whatsappGroup={raffle.whatsappGroup}
      />
      <main className="min-h-screen">
        <RaffleView
          raffle={raffle}
          winner={winner ? { number: winner.number, name: maskName(winner.order.name) } : null}
        />
      </main>
      <SiteFooter whatsapp={raffle.whatsapp} instagram={raffle.instagram} />
      <WhatsAppFloating phone={raffle.whatsapp} group={raffle.whatsappGroup} />
    </>
  );
}

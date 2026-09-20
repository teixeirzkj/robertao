import type { Metadata } from "next";
import SiteHeader, { WhatsAppFloating } from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import RaffleView from "@/components/site/RaffleView";
import SetupNotice from "@/components/site/SetupNotice";
import { getGrandWinner, getPublicRaffle } from "@/lib/raffle";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const raffle = await getPublicRaffle();
    return {
      title: `${raffle.title} | Robertão Rifas`,
      description: raffle.subtitle || raffle.description.slice(0, 160),
      openGraph: {
        title: raffle.title,
        description: raffle.subtitle,
        images: raffle.images.slice(0, 1),
      },
    };
  } catch {
    return { title: "Robertão Rifas" };
  }
}

/** Nome parcialmente mascarado para exibicao publica. */
function maskName(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts
    .slice(1)
    .map((p) => (p.length > 2 ? `${p[0]}${"*".repeat(Math.min(p.length - 1, 4))}` : p))
    .join(" ")}`;
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
      <SiteHeader instagram={raffle.instagram} />
      <main className="min-h-screen">
        <RaffleView
          raffle={raffle}
          winner={winner ? { number: winner.number, name: maskName(winner.order.name) } : null}
        />
      </main>
      <SiteFooter whatsapp={raffle.whatsapp} instagram={raffle.instagram} />
      <WhatsAppFloating phone={raffle.whatsapp} />
    </>
  );
}

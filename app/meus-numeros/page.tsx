import type { Metadata } from "next";
import SiteHeader, { WhatsAppFloating } from "@/components/site/SiteHeader";
import SiteFooter from "@/components/site/SiteFooter";
import MyNumbers from "@/components/site/MyNumbers";
import SetupNotice from "@/components/site/SetupNotice";
import { getRaffle } from "@/lib/raffle";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Meus números | Robertão Premiações",
  description: "Consulte as cotas que você já garantiu.",
};

export default async function MyNumbersPage() {
  let raffle;
  try {
    raffle = await getRaffle();
  } catch (err) {
    return (
      <SetupNotice
        message={err instanceof Error ? err.message : "Não foi possível conectar ao banco."}
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
        <MyNumbers totalNumbers={raffle.totalNumbers} />
      </main>
      <SiteFooter whatsapp={raffle.whatsapp} instagram={raffle.instagram} />
      <WhatsAppFloating phone={raffle.whatsapp} group={raffle.whatsappGroup} />
    </>
  );
}

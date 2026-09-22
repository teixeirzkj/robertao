import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600", "700"],
});

/**
 * Endereço público do site.
 *
 * Sem isto o Next resolve a imagem de compartilhamento contra
 * "http://localhost:3000" — ou seja, o link colado no WhatsApp viria sem
 * imagem nenhuma, que é justamente onde a rifa circula.
 *
 * Em preview usa a URL daquele deploy, para o teste mostrar o que foi testado.
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "https://robertaopremiacoes.com.br");

const TITULO = "Robertão Premiações";
const DESCRICAO =
  "Garanta suas cotas, concorra a prêmios instantâneos nas cotas premiadas e ao prêmio principal no sorteio final.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITULO,
  description: DESCRICAO,
  openGraph: {
    title: TITULO,
    description: DESCRICAO,
    url: SITE_URL,
    siteName: TITULO,
    locale: "pt_BR",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: TITULO, description: DESCRICAO },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${sora.variable} ${inter.variable}`}>
      <body className="bg-paper font-body text-ink noise-overlay">{children}</body>
    </html>
  );
}

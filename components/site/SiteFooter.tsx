import Link from "next/link";
import { onlyDigits } from "@/lib/utils";

export default function SiteFooter({
  whatsapp,
  instagram,
  whatsappGroup,
}: {
  whatsapp?: string;
  instagram?: string;
  whatsappGroup?: string;
}) {
  const instaUrl = instagram
    ? instagram.startsWith("http")
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  return (
    <footer className="border-t border-ink/8 bg-paper">
      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="flex flex-col items-center gap-7 text-center">
          <span className="font-display text-xl font-800">
            <span className="text-gradient-gold">ROBERTÃO</span>{" "}
            <span className="text-ink">PREMIAÇÕES</span>
          </span>

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            <Link href="/#rifa" className="text-sm text-ink/65 transition-colors hover:text-gold">
              A rifa
            </Link>
            <Link
              href="/#premiadas"
              className="text-sm text-ink/65 transition-colors hover:text-gold"
            >
              Cotas premiadas
            </Link>
            <Link
              href="/meus-numeros"
              className="text-sm text-ink/65 transition-colors hover:text-gold"
            >
              Meus números
            </Link>
            <Link
              href="/#regulamento"
              className="text-sm text-ink/65 transition-colors hover:text-gold"
            >
              Regulamento
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {instaUrl && (
              <a
                href={instaUrl}
                target="_blank"
                rel="noreferrer"
                className="flex size-10 items-center justify-center rounded-full border border-ink/10 text-xs text-ink/65 transition-colors hover:border-gold/50 hover:text-gold"
              >
                IG
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${onlyDigits(whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="flex size-10 items-center justify-center rounded-full border border-ink/10 text-xs text-ink/65 transition-colors hover:border-gold/50 hover:text-gold"
              >
                WA
              </a>
            )}
          </div>

          <div className="h-px w-full max-w-md bg-ink/5" />

          <div className="space-y-1">
            <p className="text-xs text-ink/45">
              © {new Date().getFullYear()} Robertão Premiações — Todos os direitos reservados.
            </p>
            <p className="text-xs text-ink/35">
              Operação sujeita à legislação e regulamentação aplicáveis.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { onlyDigits } from "@/lib/utils";

export default function SiteFooter({
  whatsapp,
  instagram,
}: {
  whatsapp?: string;
  instagram?: string;
}) {
  const instaUrl = instagram
    ? instagram.startsWith("http")
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  return (
    <footer className="border-t border-white/5 bg-ink-900">
      <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
        <div className="flex flex-col items-center gap-7 text-center">
          <span className="font-display text-xl font-800">
            <span className="text-gradient-gold">ROBERTÃO</span>{" "}
            <span className="text-white">RIFAS</span>
          </span>

          <nav className="flex flex-wrap items-center justify-center gap-x-7 gap-y-3">
            <Link href="/#rifa" className="text-sm text-white/60 transition-colors hover:text-gold">
              A rifa
            </Link>
            <Link
              href="/#premiadas"
              className="text-sm text-white/60 transition-colors hover:text-gold"
            >
              Cotas premiadas
            </Link>
            <Link
              href="/meus-numeros"
              className="text-sm text-white/60 transition-colors hover:text-gold"
            >
              Meus números
            </Link>
            <Link
              href="/#regulamento"
              className="text-sm text-white/60 transition-colors hover:text-gold"
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
                className="flex size-10 items-center justify-center rounded-full border border-white/10 text-xs text-white/60 transition-colors hover:border-gold/50 hover:text-gold"
              >
                IG
              </a>
            )}
            {whatsapp && (
              <a
                href={`https://wa.me/${onlyDigits(whatsapp)}`}
                target="_blank"
                rel="noreferrer"
                className="flex size-10 items-center justify-center rounded-full border border-white/10 text-xs text-white/60 transition-colors hover:border-gold/50 hover:text-gold"
              >
                WA
              </a>
            )}
          </div>

          <div className="h-px w-full max-w-md bg-white/5" />

          <div className="space-y-1">
            <p className="text-xs text-white/40">
              © {new Date().getFullYear()} Robertão Rifas — Todos os direitos reservados.
            </p>
            <p className="text-xs text-white/30">
              Operação sujeita à legislação e regulamentação aplicáveis.
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

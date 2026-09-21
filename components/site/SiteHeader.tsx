"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import {
  FileText,
  Gift,
  HelpCircle,
  Home,
  Instagram,
  Menu,
  MessageCircle,
  Search,
  Ticket,
  X,
} from "lucide-react";
import { onlyDigits } from "@/lib/utils";

const NAV = [
  { label: "Início", href: "/", icon: Home },
  { label: "A rifa", href: "/#rifa", icon: Ticket },
  { label: "Cotas premiadas", href: "/#premiadas", icon: Gift },
  { label: "Meus números", href: "/meus-numeros", icon: Search },
  { label: "Como funciona", href: "/#como-funciona", icon: HelpCircle },
  { label: "Regulamento", href: "/#regulamento", icon: FileText },
];

const NAV_DESKTOP = [
  { label: "A rifa", href: "/#rifa" },
  { label: "Cotas premiadas", href: "/#premiadas" },
  { label: "Como funciona", href: "/#como-funciona" },
];

export default function SiteHeader({
  instagram,
  whatsapp,
  whatsappGroup,
}: {
  instagram?: string;
  whatsapp?: string;
  whatsappGroup?: string;
}) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (v) => setScrolled(v > 24));

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const instaUrl = instagram
    ? instagram.startsWith("http")
      ? instagram
      : `https://instagram.com/${instagram.replace(/^@/, "")}`
    : null;

  return (
    <motion.header
      className="fixed inset-x-0 top-0 z-50"
      animate={{
        backdropFilter: scrolled ? "blur(16px)" : "blur(0px)",
        backgroundColor: scrolled ? "rgba(247,245,240,0.85)" : "rgba(247,245,240,0)",
        boxShadow: scrolled
          ? "0 1px 0 rgba(138,107,28,0.18), 0 10px 30px -18px rgba(28,24,19,0.25)"
          : "0 0 0 rgba(28,24,19,0)",
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="mx-auto flex max-w-6xl items-center justify-between px-5 lg:px-8"
        animate={{ height: scrolled ? 62 : 80 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <Link href="/" className="flex min-w-0 items-center gap-1.5">
          <span className="font-display text-base font-800 tracking-tight text-gradient-gold sm:text-xl">
            ROBERTÃO
          </span>
          <span className="truncate font-display text-base font-800 tracking-tight text-ink sm:text-xl">
            PREMIAÇÕES
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV_DESKTOP.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative text-sm text-ink/70 transition-colors duration-200 hover:text-gold"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/meus-numeros"
            className="hidden items-center gap-2 rounded-full border border-gold/40 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/10 sm:flex"
          >
            <Search className="size-3.5" />
            Meus números
          </Link>

          {instaUrl && (
            <a
              href={instaUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hidden size-9 items-center justify-center rounded-full border border-ink/10 text-ink/70 transition-colors hover:border-gold/50 hover:text-gold sm:flex"
            >
              <Instagram className="size-4" />
            </a>
          )}

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="flex size-10 items-center justify-center rounded-xl border border-ink/10 text-ink lg:hidden cursor-pointer"
          >
            <Menu className="size-5" />
          </button>
        </div>
      </motion.div>

      {/* ------------------------------------------- menu lateral no celular */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-ink/40 lg:hidden"
            />
            <motion.aside
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
              className="fixed inset-y-0 right-0 z-50 flex w-[min(86vw,20rem)] flex-col bg-paper shadow-card-hover lg:hidden"
            >
              <div className="flex items-center justify-between gap-2 border-b border-ink/8 px-4 py-4">
                <span className="min-w-0 font-display text-sm font-800">
                  <span className="text-gradient-gold">ROBERTÃO</span>{" "}
                  <span className="text-ink">PREMIAÇÕES</span>
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  aria-label="Fechar menu"
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-ink/10 text-ink cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto">
                {NAV.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 border-b border-ink/8 px-5 py-4 text-[15px] font-semibold text-ink transition-colors hover:bg-gold/5 hover:text-gold"
                  >
                    <link.icon className="size-5 shrink-0 text-gold" />
                    {link.label}
                  </Link>
                ))}
                {instaUrl && (
                  <a
                    href={instaUrl}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 border-b border-ink/8 px-5 py-4 text-[15px] font-semibold text-ink transition-colors hover:bg-gold/5 hover:text-gold"
                  >
                    <Instagram className="size-5 shrink-0 text-gold" />
                    Instagram
                  </a>
                )}
              </nav>

              <div className="space-y-2 border-t border-ink/8 p-4">
                {whatsappGroup && (
                  <a
                    href={whatsappGroup}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-bold text-white transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="size-4" />
                    Entrar no grupo
                  </a>
                )}
                {whatsapp && (
                  <a
                    href={`https://wa.me/${onlyDigits(whatsapp)}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMobileOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink/12 px-4 py-3 text-sm font-semibold text-ink transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    <MessageCircle className="size-4" />
                    Falar no WhatsApp
                  </a>
                )}
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/**
 * Botões fixos em todas as páginas: entrar no grupo (dourado) e
 * atendimento no WhatsApp (verde).
 */
export function WhatsAppFloating({ phone, group }: { phone?: string; group?: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 900);
    return () => clearTimeout(t);
  }, []);

  if (!phone && !group) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="fixed bottom-5 right-5 z-40 flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-6"
        >
          {group && (
            <a
              href={group}
              target="_blank"
              rel="noreferrer"
              aria-label="Entrar no grupo do WhatsApp"
              className="flex items-center gap-2 rounded-full bg-gold-metal bg-[length:200%_auto] px-4 py-3 text-xs font-bold text-ink-900 shadow-gold-lg transition-transform hover:scale-105"
            >
              <MessageCircle className="size-4 shrink-0" />
              Entrar no grupo
            </a>
          )}
          {phone && (
            <a
              href={`https://wa.me/${onlyDigits(phone)}`}
              target="_blank"
              rel="noreferrer"
              aria-label="Falar no WhatsApp"
              className="flex size-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-card-hover transition-transform hover:scale-105"
            >
              <svg viewBox="0 0 24 24" className="size-7" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.993 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </a>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

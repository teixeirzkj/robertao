"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "framer-motion";
import { Menu, Search, X } from "lucide-react";
import { onlyDigits } from "@/lib/utils";

const NAV = [
  { label: "A rifa", href: "/#rifa" },
  { label: "Cotas premiadas", href: "/#premiadas" },
  { label: "Como funciona", href: "/#como-funciona" },
];

export default function SiteHeader({ instagram }: { instagram?: string }) {
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
        backgroundColor: scrolled ? "rgba(10,10,11,0.78)" : "rgba(10,10,11,0)",
        boxShadow: scrolled
          ? "0 1px 0 rgba(212,175,55,0.15), 0 10px 30px -15px rgba(0,0,0,0.8)"
          : "0 0 0 rgba(0,0,0,0)",
      }}
      transition={{ duration: 0.25, ease: "easeOut" }}
    >
      <motion.div
        className="mx-auto flex max-w-6xl items-center justify-between px-5 lg:px-8"
        animate={{ height: scrolled ? 62 : 80 }}
        transition={{ duration: 0.25, ease: "easeOut" }}
      >
        <Link href="/" className="flex items-center gap-2">
          <span className="font-display text-lg font-800 tracking-tight text-gradient-gold sm:text-xl">
            ROBERTÃO
          </span>
          <span className="font-display text-lg font-800 tracking-tight text-white sm:text-xl">
            RIFAS
          </span>
        </Link>

        <nav className="hidden items-center gap-8 lg:flex">
          {NAV.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="group relative text-sm text-white/70 transition-colors duration-200 hover:text-gold"
            >
              {link.label}
              <span className="absolute -bottom-1 left-0 h-px w-0 bg-gold transition-all duration-300 group-hover:w-full" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href="/meus-numeros"
            className="flex items-center gap-2 rounded-full border border-gold/40 px-3 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/10 sm:px-4 sm:text-sm"
          >
            <Search className="size-3.5" />
            <span className="hidden sm:inline">Meus números</span>
            <span className="sm:hidden">Cotas</span>
          </Link>

          {instaUrl && (
            <a
              href={instaUrl}
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
              className="hidden size-9 items-center justify-center rounded-full border border-white/10 text-white/70 transition-colors hover:border-gold/50 hover:text-gold sm:flex"
            >
              <InstagramIcon />
            </a>
          )}

          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
            className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white lg:hidden cursor-pointer"
          >
            <Menu className="size-4" />
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-ink-900/98 backdrop-blur-xl lg:hidden"
          >
            <div className="flex h-[62px] items-center justify-between px-5">
              <span className="font-display text-lg font-800 text-gradient-gold">MENU</span>
              <button
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar menu"
                className="flex size-9 items-center justify-center rounded-full border border-white/10 text-white cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>
            <motion.nav
              initial="hidden"
              animate="show"
              variants={{ show: { transition: { staggerChildren: 0.06 } } }}
              className="flex flex-col px-5 pt-4"
            >
              {[...NAV, { label: "Meus números", href: "/meus-numeros" }].map((link) => (
                <motion.div
                  key={link.href}
                  variants={{ hidden: { opacity: 0, x: -16 }, show: { opacity: 1, x: 0 } }}
                >
                  <Link
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="block border-b border-white/5 py-4 font-display text-2xl font-semibold text-white"
                  >
                    {link.label}
                  </Link>
                </motion.div>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

export function WhatsAppFloating({ phone }: { phone: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1400);
    return () => clearTimeout(t);
  }, []);
  if (!phone) return null;

  return (
    <AnimatePresence>
      {visible && (
        <motion.a
          href={`https://wa.me/${onlyDigits(phone)}`}
          target="_blank"
          rel="noreferrer"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          aria-label="Falar no WhatsApp"
          className="fixed bottom-5 right-5 z-40 flex size-13 items-center justify-center rounded-full bg-[#25D366] p-3.5 text-ink-900 shadow-lg sm:bottom-6 sm:right-6"
        >
          <svg viewBox="0 0 24 24" className="size-6" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 016.993 2.898 9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.889 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
          </svg>
        </motion.a>
      )}
    </AnimatePresence>
  );
}

function InstagramIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="2" width="20" height="20" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

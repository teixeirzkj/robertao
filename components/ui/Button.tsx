"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

type ButtonVariant = "gold" | "outline" | "ghost" | "dark";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  children?: React.ReactNode;
}

const variants: Record<ButtonVariant, string> = {
  gold: "bg-gold-metal bg-[length:200%_auto] text-ink-900 shadow-gold hover:shadow-gold-lg font-semibold",
  outline:
    "border border-gold/50 text-gold bg-transparent hover:bg-gold/10 hover:border-gold",
  ghost: "text-ink/80 hover:text-ink hover:bg-ink/5",
  dark: "bg-paper-100 text-ink border border-ink/12 hover:border-gold/50 hover:bg-paper-200",
};

const sizes: Record<ButtonSize, string> = {
  sm: "text-xs px-4 py-2 rounded-lg",
  md: "text-sm px-5 py-3 rounded-xl",
  lg: "text-base px-7 py-4 rounded-xl",
};

export default function Button({
  variant = "gold",
  size = "md",
  loading = false,
  fullWidth = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: disabled || loading ? 1 : 1.03 }}
      whileTap={{ scale: disabled || loading ? 1 : 0.96 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex items-center justify-center gap-2 cursor-pointer select-none transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed shine-sweep",
        variants[variant],
        sizes[size],
        fullWidth && "w-full",
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin" />}
      {children}
    </motion.button>
  );
}

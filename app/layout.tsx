import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { geistMono, geistSans, inter } from "@/fonts";

export const metadata: Metadata = {
  title: "Habitta — Residence story prototype",
  description: "Three ways to explore a featured residence. A throwaway content and layout prototype.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn(
        "h-full antialiased font-sans",
        geistSans.variable,
        geistMono.variable,
        inter.variable,
      )}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { geistMono, geistSans, inter } from "@/fonts";

export const metadata: Metadata = {
  title: "Habitta — Discovery prototype",
  description: "Three ways to discover an imagined district. A throwaway interaction prototype.",
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

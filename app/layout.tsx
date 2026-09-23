import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";
import { instrumentSans, newsreader } from "@/fonts";

const description =
  "Habitta is an architecture studio showing imagined residential concepts: three buildings in one invented highland district, each with a featured residence. None is a real development or listing.";

export const metadata: Metadata = {
  title: {
    default: "Habitta · Imagined residential concepts",
    template: "%s · Habitta",
  },
  description,
  applicationName: "Habitta",
  openGraph: {
    type: "website",
    siteName: "Habitta",
    title: "Habitta · Imagined residential concepts",
    description,
    locale: "en",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={cn("antialiased", newsreader.variable, instrumentSans.variable)}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

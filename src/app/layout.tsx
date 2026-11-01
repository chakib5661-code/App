import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../index.css";

const description =
  "Plateforme officielle de Tulip Fragrance Company pour la précommande de matières premières en Algérie (Extraits et Flacons), avec synchronisation Excel POS et génération de bon de commande PDF.";

export const metadata: Metadata = {
  title: "Tulip Fragrance Company - Raw Materials & Pre-Order",
  description,
  openGraph: {
    title: "Tulip Fragrance Company - Raw Materials & Pre-Order",
    description,
    type: "website",
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: [{ url: "/tulip-logo.svg", type: "image/svg+xml" }] },
  appleWebApp: { capable: true, title: "Tulip", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preload" href="/tulip-logo.svg" as="image" type="image/svg+xml" />
        <link rel="preload" href="/tulip-extrait-default.jpg" as="image" type="image/jpeg" />
      </head>
      <body>{children}</body>
    </html>
  );
}

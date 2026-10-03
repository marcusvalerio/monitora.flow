import "./globals.css";
import AppShell from "./ui/AppShell";

export const metadata = {
  title: "Monitora — mobilidade e clima no Rio",
  description: "Onde está o seu BRT e ônibus, quanto falta para chegar e como está o tempo. Dados abertos da Prefeitura do Rio.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icone.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Monitora" },
};
export const viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#F5F5F2" }, { media: "(prefers-color-scheme: dark)", color: "#080A10" }],
  width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Geist: interface, rótulos, corpo, controles. Sora 600: números grandes, ETA, temperatura, títulos de impacto. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;450;500;600;700&family=Sora:wght@400;600&display=swap" />
      </head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

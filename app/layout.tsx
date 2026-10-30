import "./globals.css";
import { Geist, Sora } from "next/font/google";
import AppShell from "./ui/AppShell";

// Fontes variáveis servidas pelo próprio app (next/font): sem CSS bloqueante do Google nem conexões extras ao abrir.
const geist = Geist({ subsets: ["latin"], variable: "--fonte-geist", display: "swap" });
const sora = Sora({ subsets: ["latin"], variable: "--fonte-sora", display: "swap" });

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
    <html lang="pt-BR" className={`${geist.variable} ${sora.variable}`}>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

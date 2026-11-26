import "./globals.css";
import { Inter, Inter_Tight, Sora } from "next/font/google";
import AppShell from "./ui/AppShell";

// Fontes variáveis servidas pelo próprio app (next/font): sem CSS bloqueante do Google nem conexões extras ao abrir.
// Inter: seções, texto e rótulos. Inter Tight: números e dados (tabulares). Sora: só o título principal de cada aba.
const inter = Inter({ subsets: ["latin"], variable: "--fonte-inter", display: "swap" });
const interTight = Inter_Tight({ subsets: ["latin"], variable: "--fonte-inter-tight", display: "swap" });
const sora = Sora({ subsets: ["latin"], weight: ["700"], variable: "--fonte-sora", display: "swap" });

export const metadata = {
  title: "Monitora — mobilidade e clima no Rio",
  description: "Onde está o seu BRT e ônibus, quanto falta para chegar e como está o tempo. Dados abertos da Prefeitura do Rio.",
  manifest: "/manifest.webmanifest",
  icons: { icon: [{ url: "/icone.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32", type: "image/png" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Monitora" },
};
export const viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#FAF9F6" }, { media: "(prefers-color-scheme: dark)", color: "#080A10" }],
  width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${interTight.variable} ${sora.variable}`}>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

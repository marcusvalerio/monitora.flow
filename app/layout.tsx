import "./globals.css";
import AppShell from "./ui/AppShell";

export const metadata = {
  title: "Monitora — mobilidade e clima no Rio",
  description: "Onde está o seu BRT e ônibus, quanto falta para chegar e como está o tempo. Dados abertos da Prefeitura do Rio.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Monitora" },
};
export const viewport = {
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#EEF2F3" }, { media: "(prefers-color-scheme: dark)", color: "#000022" }],
  width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Display: Bricolage Grotesque (números, títulos). UI e dados: Instrument Sans. */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700&family=Instrument+Sans:wght@400;500;600;700&display=swap" />
      </head>
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

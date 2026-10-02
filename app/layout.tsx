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
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f4f5f7" }, { media: "(prefers-color-scheme: dark)", color: "#0b0d10" }],
  width: "device-width", initialScale: 1, viewportFit: "cover", interactiveWidget: "resizes-content",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body><AppShell>{children}</AppShell></body>
    </html>
  );
}

import "./globals.css";

export const metadata = {
  title: "Meu trajeto — monitora.flow",
  description: "Ônibus/BRT, ruas, chuva e previsão no seu caminho pelo Rio. Dados abertos da Prefeitura.",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icone.svg", apple: "/icone.svg" },
};
export const viewport = { themeColor: [{ media: "(prefers-color-scheme: light)", color: "#f6f7f9" }, { media: "(prefers-color-scheme: dark)", color: "#111418" }], width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

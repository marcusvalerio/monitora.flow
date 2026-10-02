export const metadata = { title: "monitora.flow", description: "Coletor e API do GPS de BRT/ônibus do Rio para o MOVA" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "2rem auto", padding: "0 16px", lineHeight: 1.5 }}>{children}</body>
    </html>
  );
}

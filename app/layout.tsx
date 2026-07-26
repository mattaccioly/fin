import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/AppToaster";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fin — Finanças pessoais",
  description: "Registro rápido de gastos e visão mensal das suas finanças",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafafa" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0c0e" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          {children}
          <AppToaster />
        </ThemeProvider>
      </body>
    </html>
  );
}

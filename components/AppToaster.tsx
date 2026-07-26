"use client";

import { Toaster } from "sonner";
import { useTheme } from "@/components/ThemeProvider";

export function AppToaster() {
  const { theme } = useTheme();

  return (
    <Toaster
      theme={theme}
      position="top-center"
      toastOptions={{
        style: {
          background: "var(--surface)",
          border: "1px solid var(--border)",
          color: "var(--fg)",
          boxShadow: "var(--shadow-overlay)",
        },
      }}
    />
  );
}

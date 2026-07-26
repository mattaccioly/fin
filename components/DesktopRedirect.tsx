"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** On desktop the home screen is the dashboard; quick entry lives in the "+ Novo gasto" modal. */
export function DesktopRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (window.matchMedia("(min-width: 1024px)").matches) {
      router.replace("/dashboard");
    }
  }, [router]);

  return null;
}

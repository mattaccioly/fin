import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/incomes", destination: "/entradas", permanent: true },
      { source: "/fixed-costs", destination: "/fixos", permanent: true },
      { source: "/debts", destination: "/fixos", permanent: true },
      { source: "/investments", destination: "/investimentos", permanent: true },
      { source: "/projects", destination: "/projetos", permanent: true },
      { source: "/projects/:id", destination: "/projetos/:id", permanent: true },
      { source: "/categories", destination: "/orcamentos", permanent: true },
    ];
  },
};

export default nextConfig;

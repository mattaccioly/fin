"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ExpenseForm } from "@/components/ExpenseForm";
import { MonthProvider } from "@/components/MonthProvider";
import { MonthWrapGate } from "@/components/MonthWrapGate";
import { Sidebar } from "@/components/Sidebar";
import { Modal } from "@/components/ui/Modal";

const NewExpenseContext = createContext<() => void>(() => {});

export function useNewExpense() {
  return useContext(NewExpenseContext);
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [newExpenseOpen, setNewExpenseOpen] = useState(false);
  const openNewExpense = useCallback(() => setNewExpenseOpen(true), []);

  return (
    <MonthProvider>
      <NewExpenseContext.Provider value={openNewExpense}>
        <MonthWrapGate />
        <div className="flex min-h-dvh">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <main className="mx-auto w-full max-w-2xl px-4 pb-28 pt-6 lg:max-w-[1360px] lg:px-10 lg:pb-12 lg:pt-10">
              {children}
            </main>
          </div>
        </div>
        <BottomNav />
        <Modal
          open={newExpenseOpen}
          onClose={() => setNewExpenseOpen(false)}
          title="Novo gasto"
        >
          <ExpenseForm
            frameless
            autoFocusAmount
            onSaved={() => setNewExpenseOpen(false)}
          />
        </Modal>
      </NewExpenseContext.Provider>
    </MonthProvider>
  );
}

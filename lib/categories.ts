import { createClient } from "@/lib/supabase/client";
import { DEFAULT_CATEGORIES, type Category } from "@/lib/types";

export async function ensureCategories(userId: string): Promise<Category[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) throw error;
  if (data && data.length > 0) return data as Category[];

  const rows = DEFAULT_CATEGORIES.map((c) => ({
    user_id: userId,
    name: c.name,
    icon: c.icon,
    color: c.color,
    monthly_budget: null,
  }));

  const { data: inserted, error: insertError } = await supabase
    .from("categories")
    .insert(rows)
    .select("*");

  if (insertError) throw insertError;
  return (inserted ?? []) as Category[];
}

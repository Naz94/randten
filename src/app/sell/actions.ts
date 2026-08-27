"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function createDraftListing(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const title = value(formData, "title");
  const description = value(formData, "description");
  const categoryId = value(formData, "categoryId");
  const condition = value(formData, "condition");
  const province = value(formData, "province");
  const city = value(formData, "city");
  const price = Number(value(formData, "price"));

  if (title.length < 3 || description.length < 10 || !categoryId || !condition || !province || !city || !Number.isFinite(price) || price < 0) {
    redirect("/sell?error=Please%20complete%20all%20listing%20fields%20correctly");
  }

  const { data, error } = await supabase
    .from("listings")
    .insert({
      seller_id: user.id,
      category_id: categoryId,
      title,
      description,
      price_cents: Math.round(price * 100),
      condition,
      province,
      city,
    })
    .select("id")
    .single();

  if (error) redirect(`/sell?error=${encodeURIComponent(error.message)}`);
  redirect(`/sell/${data.id}`);
}

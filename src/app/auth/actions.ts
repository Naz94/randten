"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function value(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "https://randten.vercel.app").replace(/\/$/, "");
}

export async function signUp(formData: FormData) {
  const displayName = value(formData, "displayName");
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");

  if (displayName.length < 2 || displayName.length > 40) {
    redirect("/signup?error=Display%20name%20must%20be%202-40%20characters");
  }
  if (!email || password.length < 8) {
    redirect("/signup?error=Enter%20a%20valid%20email%20and%20an%208%2B%20character%20password");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: `${siteUrl()}/auth/callback`,
    },
  });

  if (error) redirect(`/signup?error=${encodeURIComponent(error.message)}`);
  if (!data.session) redirect("/login?message=Check%20your%20email%20to%20confirm%20your%20RANDTEN%20account");
  redirect("/account");
}

export async function signIn(formData: FormData) {
  const email = value(formData, "email").toLowerCase();
  const password = value(formData, "password");
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/account");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function updateProfile(formData: FormData) {
  const displayName = value(formData, "displayName");
  const province = value(formData, "province") || null;
  const city = value(formData, "city") || null;
  if (displayName.length < 2 || displayName.length > 40) {
    redirect("/account?error=Display%20name%20must%20be%202-40%20characters");
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, province, city })
    .eq("id", user.id);
  if (error) redirect(`/account?error=${encodeURIComponent(error.message)}`);
  redirect("/account?message=Profile%20updated");
}

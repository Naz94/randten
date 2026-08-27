import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("categories").select("id", { count: "exact", head: true });
    if (error) {
      return NextResponse.json({ ok: false, service: "supabase", error: error.message }, { status: 503 });
    }
    return NextResponse.json({ ok: true, service: "supabase" });
  } catch (error) {
    return NextResponse.json({ ok: false, service: "app", error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

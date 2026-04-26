import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function isAdminUser(): Promise<boolean> {
  try {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
        },
      },
    )
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return false
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id).single()
    return data?.role === "admin"
  } catch {
    return false
  }
}

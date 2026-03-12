"use client";

import { useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

// The search functionality has moved to the lobby page.
// This page redirects users to the appropriate location.
export default function SearchPage() {
  const params = useParams();
  const router = useRouter();
  const code = params.code as string;

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    async function checkAndRedirect() {
      const { data: room } = await supabase
        .from("rooms")
        .select("status")
        .eq("code", code)
        .single();

      if (room?.status === "lobby") {
        router.replace(`/room/${code}/lobby`);
      } else {
        // In swiping phase, go to the main swipe page
        router.replace(`/room/${code}`);
      }
    }
    checkAndRedirect();
  }, [code, supabase, router]);

  return (
    <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
      <Loader2 className="w-8 h-8 text-accent animate-spin" />
    </div>
  );
}

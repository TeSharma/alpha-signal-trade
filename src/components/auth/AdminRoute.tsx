import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import NotFound from "@/pages/NotFound";

export const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const [state, setState] = useState<"loading" | "allow" | "deny">("loading");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const uid = userRes.user?.id;
      if (!uid) { if (active) setState("deny"); return; }
      const { data: roleRows } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", uid);
      if (!active) return;
      const admin = (roleRows ?? []).some((r: any) => r.role === "admin");
      setState(admin ? "allow" : "deny");
    })();
    return () => { active = false; };
  }, []);

  if (state === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );
  }
  if (state === "deny") return <NotFound />;
  return <>{children}</>;
};

export default AdminRoute;

import { supabase } from "@/integrations/supabase/client";

export async function appendOperationalRecord(event: object, incidentId: string): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return false;
  const { error } = await supabase.from("operational_audit_records").insert({ incident_id: incidentId, event: JSON.parse(JSON.stringify(event)), user_id: data.session.user.id });
  if (error) throw new Error("Operational record could not be saved to Cloud");
  return true;
}
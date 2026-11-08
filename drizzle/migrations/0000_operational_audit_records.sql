CREATE TABLE public.operational_audit_records (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 user_id uuid NOT NULL DEFAULT auth.uid(),
 recorded_at timestamptz NOT NULL DEFAULT now(),
 incident_id text NOT NULL,
 event jsonb NOT NULL,
 simulation_version text NOT NULL DEFAULT 'telemetry-v2',
 expires_at timestamptz NOT NULL DEFAULT (now() + interval '90 days')
);
GRANT SELECT, INSERT ON public.operational_audit_records TO authenticated;
GRANT ALL ON public.operational_audit_records TO service_role;
ALTER TABLE public.operational_audit_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY own_audit_read ON public.operational_audit_records FOR SELECT TO authenticated USING (user_id = (select auth.uid()) AND expires_at > now());
CREATE POLICY own_audit_append ON public.operational_audit_records FOR INSERT TO authenticated WITH CHECK (user_id = (select auth.uid()));
CREATE INDEX operational_audit_owner_time ON public.operational_audit_records(user_id, recorded_at DESC);
CREATE FUNCTION public.enforce_audit_retention() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$ BEGIN NEW.recorded_at := now(); NEW.expires_at := now() + interval '90 days'; RETURN NEW; END; $$;
CREATE TRIGGER audit_retention BEFORE INSERT ON public.operational_audit_records FOR EACH ROW EXECUTE FUNCTION public.enforce_audit_retention();
COMMENT ON TABLE public.operational_audit_records IS 'Append-only user-scoped simulated operational records. Expired records are hidden after 90 days; physical deletion is not scheduled.';
import type { RegistrationRole, Specialization } from "./registration";
export type RegistrationStep = "roles" | "profile" | "performer";
export type RegistrationResponse = {
  roles: RegistrationRole[];
  profile: { display_name: string; avatar_url: string | null; university: string; city: string; about: string };
  performer: { description: string; study_year: string; portfolio: string; specializations: Specialization[] } | null;
  progress: { current_step: RegistrationStep; performer_skipped: boolean; updated_at: string | null };
  status: { is_complete: boolean; completed_at: string | null; missing_fields: string[]; performer_ready: boolean; performer_missing_fields: string[] };
};
export type RegistrationPatch = {
  roles?: RegistrationRole[];
  profile?: Partial<Omit<RegistrationResponse["profile"], "avatar_url">>;
  performer?: { description: string; study_year: string; portfolio: string; specialization_ids: string[] };
  progress?: { current_step?: RegistrationStep; performer_skipped?: boolean };
};

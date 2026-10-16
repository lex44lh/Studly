// Frontend view models, not an agreed Django wire contract.
export type RegistrationRole = "customer" | "performer";

export type Specialization = { id: string; title: string };

export type RegistrationDraft = {
  roles: RegistrationRole[];
  profile: {
    displayName: string;
    avatarFile: File | null;
    avatarUrl: string;
    university: string;
    city: string;
    about: string;
  };
  performer: {
    specializations: Specialization[];
    description: string;
    studyYear: string;
    portfolio: string;
  };
};

export type ProfilePrefill = { displayName?: string; avatarUrl?: string };

export type ClientResult<T> =
  | { status: "available"; data: T }
  | { status: "unavailable" };

// A future Django adapter maps its actual contract to these frontend models.
export interface RegistrationClient {
  loadDraft(signal: AbortSignal): Promise<ClientResult<RegistrationDraft | null>>;
  listSpecializations(signal: AbortSignal): Promise<ClientResult<Specialization[]>>;
  submitDraft(draft: RegistrationDraft): Promise<ClientResult<void>>;
}

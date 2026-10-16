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

// Adapter is backed by the published Django registration contract.
export type RegistrationClient = typeof import("@/lib/api/registration").registrationClient;

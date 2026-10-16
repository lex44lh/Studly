import type { ProfilePrefill, RegistrationDraft, RegistrationRole, Specialization } from "../../types/registration";

export type DraftState = {
  draft: RegistrationDraft;
  nameEdited: boolean;
  avatarEdited: boolean;
};

export function createDraftState(): DraftState {
  return {
    draft: {
      roles: [],
      profile: { displayName: "", avatarFile: null, avatarUrl: "", university: "", city: "", about: "" },
      performer: { specializations: [], description: "", studyYear: "", portfolio: "" },
    },
    nameEdited: false,
    avatarEdited: false,
  };
}

export type DraftAction =
  | { type: "role"; role: RegistrationRole }
  | { type: "profile"; patch: Partial<RegistrationDraft["profile"]> }
  | { type: "performer"; patch: Partial<RegistrationDraft["performer"]> }
  | { type: "prefill"; data: ProfilePrefill }
  | { type: "restore"; draft: RegistrationDraft };

export function draftReducer(state: DraftState, action: DraftAction): DraftState {
  const { draft } = state;
  switch (action.type) {
    case "role":
      return { ...state, draft: { ...draft, roles: draft.roles.includes(action.role)
        ? draft.roles.filter(role => role !== action.role) : [...draft.roles, action.role] } };
    case "profile":
      return {
        ...state,
        nameEdited: state.nameEdited || "displayName" in action.patch,
        avatarEdited: state.avatarEdited || "avatarUrl" in action.patch || "avatarFile" in action.patch,
        draft: { ...draft, profile: { ...draft.profile, ...action.patch } },
      };
    case "performer":
      return { ...state, draft: { ...draft, performer: { ...draft.performer, ...action.patch } } };
    case "prefill":
      return { ...state, draft: { ...draft, profile: {
        ...draft.profile,
        displayName: state.nameEdited ? draft.profile.displayName : draft.profile.displayName || action.data.displayName || "",
        avatarUrl: state.avatarEdited ? draft.profile.avatarUrl : draft.profile.avatarUrl || action.data.avatarUrl || "",
      } } };
    case "restore":
      // Future restoration is explicit, before editing; never silently overwrite a live form.
      return { draft: action.draft, nameEdited: true, avatarEdited: true };
  }
}

export function prerequisitePath(draft: RegistrationDraft, step: "roles" | "profile" | "performer"): string | null {
  if (step === "roles") return null;
  if (!draft.roles.length) return "/register/roles";
  if (step === "performer" && (!draft.roles.includes("performer") || !draft.profile.displayName.trim())) {
    return "/register/profile";
  }
  return null;
}

export function filterSpecializations(options: Specialization[], query: string): Specialization[] {
  const normalized = query.trim().toLocaleLowerCase("ru");
  return options.filter(option => option.title.toLocaleLowerCase("ru").includes(normalized));
}

export function toggleSpecialization(selected: Specialization[], option: Specialization): Specialization[] {
  return selected.some(item => item.id === option.id)
    ? selected.filter(item => item.id !== option.id) : [...selected, option];
}

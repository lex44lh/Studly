import type { RegistrationDraft, Specialization } from "@/types/registration";
import type { RegistrationPatch, RegistrationResponse } from "@/types/registration-api";
import { ApiError, apiMutation, apiRequest, pagePath } from "./client";

function readRegistration(value: RegistrationResponse): RegistrationResponse {
  if (!value || !Array.isArray(value.roles) || value.roles.some(role => !["customer", "performer"].includes(role)) ||
      !value.profile || !["display_name", "university", "city", "about"].every(key => typeof value.profile[key as keyof typeof value.profile] === "string") ||
      (value.profile.avatar_url !== null && value.profile.avatar_url !== "/api/v1/registration/avatar/") ||
      (value.performer !== null && value.performer.specializations?.some(item => typeof item.id !== "string" || typeof item.title !== "string")) ||
      !value.progress || !["roles", "profile", "performer"].includes(value.progress.current_step) ||
      typeof value.progress.performer_skipped !== "boolean" || !value.status || typeof value.status.is_complete !== "boolean" ||
      typeof value.status.performer_ready !== "boolean" || !Array.isArray(value.status.missing_fields) ||
      (value.performer !== null && (!Array.isArray(value.performer?.specializations) ||
        ![value.performer.description, value.performer.study_year, value.performer.portfolio].every(item => typeof item === "string")))) {
    throw new ApiError(502, null);
  }
  return value;
}
export function toDraft(value: RegistrationResponse): RegistrationDraft {
  return {
    roles: value.roles,
    profile: { displayName: value.profile.display_name, avatarFile: null, avatarUrl: value.profile.avatar_url ?? "",
      university: value.profile.university, city: value.profile.city, about: value.profile.about },
    performer: { specializations: value.performer?.specializations ?? [], description: value.performer?.description ?? "",
      studyYear: value.performer?.study_year ?? "", portfolio: value.performer?.portfolio ?? "" },
  };
}
export const registrationClient = {
  async loadDraft(signal?: AbortSignal) { return readRegistration(await apiRequest<RegistrationResponse>("registration/", { signal })); },
  async save(patch: RegistrationPatch, signal?: AbortSignal) {
    return readRegistration(await apiMutation<RegistrationResponse>("registration/", "PATCH", patch, signal));
  },
  async complete(signal?: AbortSignal) {
    const value = readRegistration(await apiMutation<RegistrationResponse>("registration/complete/", "POST", {}, signal));
    if (!value.status.is_complete) throw new ApiError(502, null);
    return value;
  },
  async listSpecializations(signal: AbortSignal) {
    const options: Specialization[] = [];
    let path: string | null = "specializations/";
    const visited = new Set<string>();
    while (path) {
      if (visited.has(path)) throw new ApiError(502, null);
      visited.add(path);
      const page: { results: Specialization[]; next: string | null } = await apiRequest(path, { signal });
      if (!Array.isArray(page.results) || page.results.some(item => typeof item.id !== "string" || typeof item.title !== "string")) throw new ApiError(502, null);
      options.push(...page.results);
      path = page.next ? pagePath(page.next, "specializations/") : null;
    }
    return options;
  },
  async uploadAvatar(file: File, signal?: AbortSignal) {
    const body = new FormData(); body.append("avatar", file);
    const value = readRegistration(await apiMutation<RegistrationResponse>("registration/avatar/", "POST", body, signal));
    if (!value.profile.avatar_url) throw new ApiError(502, null);
    return value;
  },
  deleteAvatar: (signal?: AbortSignal) => apiMutation<void>("registration/avatar/", "DELETE", undefined, signal),
};

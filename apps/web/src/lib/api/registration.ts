import type { RegistrationClient } from "@/types/registration";

// No requests or fabricated success while the Django contract is pending.
export const registrationClient: RegistrationClient = {
  async loadDraft() { return { status: "unavailable" }; },
  async listSpecializations() { return { status: "unavailable" }; },
  async submitDraft() { return { status: "unavailable" }; },
};

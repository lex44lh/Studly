import PerformerForm from "@/components/registration/PerformerForm";
import { RegistrationStep } from "@/components/registration/RegistrationShell";

export default function PerformerPage() {
  return <RegistrationStep step="performer" title="Расскажите, чем вы занимаетесь" intro="Добавьте информацию о своих навыках сейчас или вернитесь к ней позже.">
    <PerformerForm />
  </RegistrationStep>;
}

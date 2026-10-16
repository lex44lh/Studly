import ProfileForm from "@/components/registration/ProfileForm";
import { RegistrationStep } from "@/components/registration/RegistrationShell";

export default function ProfilePage() {
  return <RegistrationStep step="profile" title="Давайте познакомимся!" intro="Расскажите немного о себе. Для продолжения достаточно имени.">
    <ProfileForm />
  </RegistrationStep>;
}

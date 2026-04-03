import { RegistrationForm } from "@/components/RegistrationForm";

export default function RegisterPage() {
  return (
    <div className="space-y-8 p-6 md:p-8 animate-in fade-in duration-500">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Register Students</h1>
        <p className="text-muted-foreground">Register students for the swimming meet.</p>
      </div>
      <RegistrationForm />
    </div>
  );
}

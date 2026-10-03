"use client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { teamLabel, type TeamInput } from "@/lib/meet-configuration";
export function RegistrationTeamSelect({
  teams,
  value,
  onChange,
}: {
  teams: TeamInput[];
  value?: string;
  onChange: (team: TeamInput) => void;
}) {
  return (
    <Select
      value={value}
      onValueChange={(id) => {
        const team = teams.find((t) => (t.id ?? t.code) === id);
        if (team) onChange(team);
      }}
    >
      <SelectTrigger aria-label="Swimmer's meet team" className="w-full">
        <SelectValue placeholder="Choose team" />
      </SelectTrigger>
      <SelectContent>
        {teams.map((team) => (
          <SelectItem key={team.id ?? team.code} value={team.id ?? team.code}>
            {teamLabel(team)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

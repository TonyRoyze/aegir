export const FACULTIES = [
  "FOA",
  "FOE",
  "FIM",
  "FOL",
  "FMF",
  "FOM",
  "FOS",
  "FOT",
  "FON",
  "USCS",
] as const;

export type Faculty = (typeof FACULTIES)[number];

export type Gender = "Male" | "Female";

export interface Student {
  id: string;
  name: string;
  nameInUse: string;
  gender: Gender;
  faculty: Faculty;
  seed?: number;
}

export const SWIM_EVENTS = [
  "25m Freestyle",
  "50m Freestyle",
  "100m Freestyle",
  "200m Freestyle",
  "400m Freestyle",
  "25m Backstroke",
  "50m Backstroke",
  "100m Backstroke",
  "200m Backstroke",
  "25m Breaststroke",
  "50m Breaststroke",
  "100m Breaststroke",
  "200m Breaststroke",
  "25m Butterfly",
  "50m Butterfly",
  "100m Butterfly",
  "200m Butterfly",
  "100m Individual Medley",
  "200m Individual Medley",
  "4x25m Freestyle Relay",
  "4x25m Medley Relay",
  "4x50m Freestyle Relay",
  "4x50m Medley Relay",
] as const;

export type SwimEvent = (typeof SWIM_EVENTS)[number];

export interface Registration {
  id: string;
  student: Student;
  events: SwimEvent[];
  meetId: string;
  registeredAt: Date;
}

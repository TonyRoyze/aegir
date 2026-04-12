import { assignToHeats, LANES_PER_HEAT } from "@/lib/swimming-utils";

export const MEET_PROGRAM_STORAGE_KEY = "aegir-meet-program-document";

export interface MeetProgramMeet {
  name: string;
  events: string[];
}

export interface MeetProgramStudent {
  _id?: string;
  id?: string;
  name: string;
  faculty?: string;
  gender?: string;
}

export interface MeetProgramRegistration {
  _id?: string;
  id?: string;
  student: MeetProgramStudent;
  events: string[];
}

export interface MeetProgramGroup {
  label: string;
  heats: Array<Array<MeetProgramStudent | null>>;
}

export interface MeetProgramEvent {
  name: string;
  number: number;
  groups: MeetProgramGroup[];
}

export interface MeetProgramDocumentData {
  meet: MeetProgramMeet;
  registrations: MeetProgramRegistration[];
  orderedEvents: string[];
}

export function createDefaultMeetProgramDocument(): MeetProgramDocumentData {
  return {
    meet: {
      name: "Meet Name",
      events: [],
    },
    registrations: [],
    orderedEvents: [],
  };
}

export function buildMeetProgramEvents(
  registrations: MeetProgramRegistration[],
  orderedEvents: string[],
): MeetProgramEvent[] {
  if (!orderedEvents.length) {
    return [];
  }

  const map = new Map<string, MeetProgramStudent[]>();

  orderedEvents.forEach((eventName) => map.set(eventName, []));

  registrations.forEach((registration) => {
    registration.events.forEach((eventName) => {
      if (map.has(eventName)) {
        map.get(eventName)?.push(registration.student);
      }
    });
  });

  return orderedEvents.map((eventName, index) => {
    const students = map.get(eventName) || [];
    const isRelay = eventName.toLowerCase().includes("relay");

    let studentsToProcess = students;

    if (isRelay) {
      const facultyTeams = new Map<string, MeetProgramStudent>();

      students.forEach((student) => {
        const faculty = student.faculty || "Unknown";

        if (!facultyTeams.has(faculty)) {
          facultyTeams.set(faculty, {
            _id: faculty,
            id: faculty,
            name: faculty,
            faculty,
            gender: student.gender,
          });
        }
      });

      studentsToProcess = Array.from(facultyTeams.values());
    }

    const men = studentsToProcess.filter((student) => student.gender === "Male");
    const women = studentsToProcess.filter((student) => student.gender === "Female");
    const groups: MeetProgramGroup[] = [];

    const processGroup = (groupStudents: MeetProgramStudent[], label: string) => {
      const sorted = [...groupStudents].sort((a, b) => a.name.localeCompare(b.name));
      const heats = assignToHeats(sorted, LANES_PER_HEAT) as Array<Array<MeetProgramStudent | null>>;

      if (heats.length > 0) {
        groups.push({ label, heats });
      }
    };

    if (women.length > 0) {
      processGroup(women, "Women");
    }

    if (men.length > 0) {
      processGroup(men, "Men");
    }

    if (studentsToProcess.length === 0) {
      groups.push({
        label: "",
        heats: [new Array<MeetProgramStudent | null>(LANES_PER_HEAT).fill(null)],
      });
    } else if (groups.length === 0) {
      const others = studentsToProcess.filter(
        (student) => student.gender !== "Male" && student.gender !== "Female",
      );

      if (others.length > 0) {
        processGroup(others, "Participants");
      }
    }

    return {
      name: eventName,
      number: index + 1,
      groups,
    };
  });
}

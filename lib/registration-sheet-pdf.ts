export const REGISTRATION_SHEET_STORAGE_KEY = "aegir-registration-sheet-document";

export interface RegistrationSheetMeet {
  name: string;
  events: string[];
}

export interface RegistrationSheetStudent {
  id?: string;
  name?: string;
  registrationNumber?: string;
  nameInUse?: string;
  age?: number;
  gender?: "Male" | "Female";
  faculty?: string;
}

export interface RegistrationSheetRegistration {
  id?: string;
  student?: RegistrationSheetStudent;
  events?: string[];
  registeredAt?: string | Date;
}

export interface RegistrationSheetDocumentData {
  meet: RegistrationSheetMeet;
  registrations: RegistrationSheetRegistration[];
  filters: {
    gender: "Male" | "Female";
    faculty: string;
  };
}

export function createDefaultRegistrationSheetDocument(): RegistrationSheetDocumentData {
  return {
    meet: {
      name: "Meet Name",
      events: [],
    },
    registrations: [],
    filters: {
      gender: "Male",
      faculty: "",
    },
  };
}

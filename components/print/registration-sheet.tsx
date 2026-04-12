"use client"

import { useMemo } from "react"
import { CheckIcon } from "lucide-react"
import type { RegistrationSheetDocumentData, RegistrationSheetRegistration } from "@/lib/registration-sheet-pdf"

interface RegistrationSheetProps {
  meet: RegistrationSheetDocumentData["meet"];
  registrations: RegistrationSheetRegistration[];
  filters: RegistrationSheetDocumentData["filters"];
}

export function RegistrationSheet({ meet, registrations, filters }: RegistrationSheetProps) {
  // Filter registrations by gender and faculty
  const filteredRegistrations = useMemo(() => {
    return registrations.filter(
      (reg) => reg.student?.gender === filters.gender && reg.student?.faculty === filters.faculty
    );
  }, [registrations, filters]);

  const events = meet.events || [];

  const currentYear = new Date().getFullYear();

  return (
    <div
      id="printable-content"
      className="registration-sheet-page mx-auto max-w-[297mm] min-h-[210mm] bg-white px-6 py-5"
    >
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-xl font-bold italic">Inter-Faculty Swimming Championship - {currentYear}</h1>
        <p className="text-base font-bold mt-1">Department of Physical Education</p>
        <p className="text-base font-bold">University of Colombo</p>
      </div>

      {/* Form Fields */}
      <div className="mb-4 text-sm">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-28">Faculty/ Institute</span>
          <span>: -</span>
          <span className="flex-1 border-b border-dotted border-black">{filters.faculty}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-28">Date</span>
          <span>: -</span>
          <span className="w-48 border-b border-dotted border-black">{new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Entry Form Title with Gender Checkboxes */}
      <div className="flex items-center justify-center gap-8 mb-4">
        <span className="text-lg font-bold">Entry Form</span>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2">
            <span className={`w-4 h-4 border border-black flex items-center justify-center ${filters.gender === "Male" ? "bg-black" : ""}`}>
              {filters.gender === "Male" && <span className="text-white text-xs">✓</span>}
            </span>
            <span>Men</span>
          </label>
          <label className="flex items-center gap-2">
            <span className={`w-4 h-4 border border-black flex items-center justify-center ${filters.gender === "Female" ? "bg-black" : ""}`}>
              {filters.gender === "Female" && <span className="text-white text-xs">✓</span>}
            </span>
            <span>Women</span>
          </label>
        </div>
      </div>

      {/* Table */}
      <table className="w-full border-collapse border border-black text-xs">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-black p-2 text-left w-8">#</th>
            <th className="border border-black p-2 text-left min-w-[180px]">Student Name</th>
            <th className="border border-black p-2 text-left min-w-[100px]">Reg. No</th>
            {events.map((event) => (
              <th key={event} className="border border-black p-1 text-center w-8 align-bottom">
                <span className="block whitespace-nowrap [writing-mode:vertical-rl] rotate-180 mx-auto text-[10px]">
                  {event}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredRegistrations.length === 0 ? (
            <tr>
              <td colSpan={events.length + 3} className="border border-black p-4 text-center text-neutral-500 italic">
                No registrations found for {filters.gender === "Male" ? "Men" : "Women"} - {filters.faculty}
              </td>
            </tr>
          ) : (
            filteredRegistrations.map((reg, index) => (
              <tr key={reg.id} className="hover:bg-neutral-50">
                <td className="border border-black p-2 text-center font-medium">{index + 1}</td>
                <td className="border border-black p-2 font-medium">{reg.student?.name || ""}</td>
                <td className="border border-black p-2">{reg.student?.registrationNumber || ""}</td>
                {events.map((event) => {
                  const isChecked = reg.events?.includes(event);
                  return (
                    <td key={event} className="border border-black p-1 text-center">
                      {isChecked && <CheckIcon className="h-3 w-3 stroke-black mx-auto" />}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Rules Note */}
      <div className="mt-6 text-xs">
        <ul className="list-disc pl-5">
          <li>One Student can apply only for a maximum of three events excluding relays and IM</li>
        </ul>
      </div>

      {/* Team Captain Section */}
      <div className="mt-6 text-xs">
        <div className="flex items-end justify-between gap-8">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span>Name of the team captain: </span>
              <span className="flex-1 border-b border-dotted border-black min-w-[200px]"></span>
            </div>
          </div>
          <div className="text-right">
            <span className="border-b border-dotted border-black inline-block min-w-[120px]"></span>
            <p className="mt-1">Signature</p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <span>Contact No</span>
          <span>: -</span>
          <span className="border-b border-dotted border-black w-48"></span>
        </div>
      </div>

      {/* Certification */}
      <div className="mt-6 text-xs">
        <p>I hereby certify the above mentioned students are internal students of the above mentioned Faculty/ Institute.</p>
      </div>

      {/* Signatures Section */}
      <div className="mt-8 grid grid-cols-[1.1fr_1.35fr_110px] items-end gap-8 text-xs">
        <div className="flex flex-col items-start">
          <span className="inline-block w-full border-b border-dotted border-black"></span>
          <p className="mt-2 leading-tight">Instructor /PE (Faculty Representative)</p>
        </div>

        <div className="flex flex-col items-center">
          <span className="inline-block w-full border-b border-dotted border-black"></span>
          <p className="mt-2 text-center leading-tight">Signature of Dean / Director / AR</p>
        </div>

        <div className="flex flex-col items-center justify-end">
          <div className="h-20 w-20 border border-dashed border-black"></div>
          <p className="mt-2 text-center">Stamp</p>
        </div>
      </div>

      {/* Contact Info */}
      <div className="mt-6 text-xs italic">
        <p>Contact: - Mr. Wasantha Rathnayake (Instructor in Physical Education) - 071 8834468</p>
      </div>
    </div>
  );
}

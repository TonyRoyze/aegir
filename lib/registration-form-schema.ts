import { z } from "zod";

const registrationSchema = z.object({
  id: z.string(),
  teamId: z.string().optional(),
  student: z.object({
    id: z.string(),
    name: z.string().min(1, "Name is required"),
    registrationNumber: z.string(),
    nameInUse: z.string(),
    gender: z.enum(["Male", "Female"]).optional(),
    faculty: z.string().optional(),
    seed: z.number().optional(),
  }),
  events: z.array(z.string()),
  registeredAt: z.union([z.string(), z.date()]),
});

export const formSchema = z.object({
  registrations: z.array(registrationSchema),
});

export type FormValues = z.infer<typeof formSchema>;

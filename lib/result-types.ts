import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
export type MeetResult = FunctionReturnType<
  typeof api.results.getMeetResults
>[number];

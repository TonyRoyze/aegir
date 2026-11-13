import type { UseFormReturn, UseFieldArrayReturn } from "react-hook-form";
import type { FormValues } from "./registration-form-schema";
import { registrationSnapshot } from "./registration-snapshot";

/** Apply server rows without resetting field-array keys or remounting inputs. */
export function reconcileRegistrationRows(
  saved: FormValues["registrations"],
  form: UseFormReturn<FormValues>,
  {
    append,
    remove,
  }: Pick<
    UseFieldArrayReturn<FormValues, "registrations", "formKey">,
    "append" | "remove"
  >,
) {
  const current = form.getValues("registrations");
  const savedIds = new Set(saved.map((row) => row.id));
  // Preserve blank drafts and field-array keys so saving never remounts inputs.
  const deleted = current.flatMap((row, index) =>
    !savedIds.has(row.id) &&
    (row.student.name ||
      row.student.registrationNumber ||
      row.student.nameInUse ||
      row.events.length)
      ? [index]
      : [],
  );
  if (deleted.length) remove(deleted);
  const retained = current.filter((_, index) => !deleted.includes(index));
  saved.forEach((row) => {
    const index = retained.findIndex((local) => local.id === row.id);
    if (index === -1) {
      append(row, { shouldFocus: false });
    } else if (
      registrationSnapshot([retained[index]]) !== registrationSnapshot([row])
    ) {
      form.setValue(`registrations.${index}`, row);
    }
  });
}

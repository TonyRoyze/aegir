import { EventOrderEditor } from "@/components/event-order-editor";

export default async function EditEventOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ meet?: string }>;
}) {
  const { meet } = await searchParams;
  return <EventOrderEditor meetId={meet} />;
}

/** Current meet policy: relays and individual medley are exempt from the three-event limit. */
export function isRegistrationLimitExceeded(
  events: readonly string[] = [],
): boolean {
  return (
    events.filter((event) => !/relay|individual medley/i.test(event)).length > 3
  );
}
export function eventCapacity(event: string): number {
  return /relay/i.test(event) ? 4 : 2;
}

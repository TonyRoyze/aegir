export function formatTime(
  ms: number | undefined | null,
  compact = false,
): string {
  if (ms == null || (!compact && ms === 0)) return "-";
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const hundredths = Math.floor((ms % 1000) / 10)
    .toString()
    .padStart(2, "0");
  return compact && minutes === 0
    ? `${seconds}.${hundredths}`
    : `${minutes}:${seconds.toString().padStart(2, "0")}.${hundredths}`;
}

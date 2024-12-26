/**
 * Format date to YYYY-MM-DD_HH-mm-ss
 */
export function formatTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

/**
 * Format log file path with timestamp
 */
export function formatLogPath(logPath: string): string | null {
  try {
    if (!logPath) return null;
    return `output_${formatTimestamp()}.log`;
  } catch (error) {
    console.error(`Failed to format log path: ${error}`);
    return null;
  }
}

export function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
}

export function parseTimeToSeconds(timeStr: string) {
  if (!timeStr || !timeStr.includes(":")) return parseFloat(timeStr) || 0
  return timeStr.split(":").reduce((a, v) => a * 60 + parseFloat(v), 0)
}

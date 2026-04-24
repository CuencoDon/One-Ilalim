export const relativeTime = (iso?: string | null) => {
  if (!iso) return "just now";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
};

export const exactTime = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleString() : "";

export const formatClockDate = (date: Date): string => {
  return date.toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

export const formatClockTime = (date: Date): string => {
  return date.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

export const formatTime12Hour = (time?: string): string => {
  if (!time) return "N/A";

  const [hourText, minuteText = "00"] = time.split(":");
  const hour = Number(hourText);

  if (Number.isNaN(hour)) return time;

  const suffix = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;

  return `${hour12}:${minuteText} ${suffix}`;
};
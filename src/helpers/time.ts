type TimeUnit = "s" | "m" | "h" | "d" | "w";
type OutputFormat = "in_ms" | "in_s" | "in_m" | "in_h" | "in_d";

const timeMultipliers = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} satisfies Record<TimeUnit, number>;

// Create a type that represents a valid time string, e.g., "10s", "5m", etc.
type ValidTimeString<T extends TimeUnit = TimeUnit> = `${number}${T}`;

function outputFormatToUnit(timeMs: number, outputFormat: OutputFormat) {
  switch (outputFormat) {
    case "in_ms":
      return timeMs;
    case "in_s":
      return timeMs / timeMultipliers.s;
    case "in_m":
      return timeMs / timeMultipliers.m;
    case "in_h":
      return timeMs / timeMultipliers.h;
    case "in_d":
      return timeMs / timeMultipliers.d;
    default:
      throw new Error(`Invalid output format: ${outputFormat}`);
  }
}

function _time<T extends TimeUnit>(
  timeString: ValidTimeString<T>,
  outputFormat: OutputFormat = "in_s",
) {
  const value = Number.parseInt(timeString, 10);
  const unit = timeString.slice(-1) as T;

  if (Number.isNaN(value)) {
    throw new Error("Invalid numeric value in time string.");
  }

  const milliseconds = value * timeMultipliers[unit];
  return outputFormatToUnit(milliseconds, outputFormat);
}

export const time = Object.assign(_time, {
  now(outputFormat: OutputFormat = "in_s") {
    const now = Date.now();
    return outputFormatToUnit(now, outputFormat);
  },

  untilEndOfDay(outputFormat: OutputFormat = "in_s") {
    const now = Date.now();
    const result = now - (now % time("1d", "in_ms"));
    return outputFormatToUnit(result, outputFormat);
  },
});

type TimeUnit = "ms" | "s" | "m" | "h" | "d" | "w";

const timeMultipliers = {
  ms: 1,
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
  w: 7 * 24 * 60 * 60 * 1000,
} satisfies Record<TimeUnit, number>;

// Create a type that represents a valid time string, e.g., "10s", "5m", etc.
type ValidTimeString<T extends TimeUnit = TimeUnit> = `${number}${T}`;

type OutputOptions = {
  out?: TimeUnit;
  round?: boolean;
};

function outputFormatToUnit(timeMs: number, options?: OutputOptions) {
  const unit = options?.out ?? "s";
  const round = options?.round ?? true;

  const result = timeMs / timeMultipliers[unit];
  return round ? Math.round(result) : result;
}

function _time<T extends TimeUnit>(
  timeString: ValidTimeString<T>,
  options: OutputOptions = { out: "s", round: true },
) {
  const value = Number.parseInt(timeString, 10);
  const unit = timeString.replace(/\d+/, "") as T;

  if (Number.isNaN(value)) {
    throw new Error("Invalid numeric value in time string.");
  }

  const milliseconds = value * timeMultipliers[unit];
  return outputFormatToUnit(milliseconds, options);
}

export const time = Object.assign(_time, {
  now(options: OutputOptions = { out: "s", round: true }) {
    const now = Date.now();
    return outputFormatToUnit(now, options);
  },

  untilEndOfDay(options: OutputOptions = { out: "s", round: true }) {
    const now = Date.now();
    const result = now - (now % time("1d", { out: "ms" }));
    return outputFormatToUnit(result, options);
  },
});

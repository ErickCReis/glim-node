type Unit = "ms" | "s" | "m";

export const time = {
  now(unit: Unit = "ms") {
    const now = Date.now();
    switch (unit) {
      case "ms":
        return now;
      case "s":
        return Math.round(now / 1000);
      case "m":
        return Math.round(now / 1000 / 60);
    }
  },

  untilEndOfDay(unit: Unit = "ms") {
    const now = Date.now();
    const result = now - (now % 86400000);
    switch (unit) {
      case "ms":
        return result;
      case "s":
        return Math.round(result / 1000);
      case "m":
        return Math.round(result / 1000 / 60);
    }
  },
};

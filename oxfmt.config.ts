import { defineConfig } from "oxfmt";

export default defineConfig({
  ignorePatterns: ["**/node_modules", "**/dist", "**/db/migrations/meta/**/*"],
});

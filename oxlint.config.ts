import { defineConfig } from "oxlint";

export default defineConfig({
  ignorePatterns: ["**/node_modules", "**/dist", "examples/**/*"],
  options: {
    typeCheck: true,
    typeAware: true,
  },
});

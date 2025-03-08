#!/usr/bin/env node

import { intro, isCancel, log, outro, select } from "@clack/prompts";

intro("Glim Node (GN)");

const command = await select({
  message: "Choose a migration command:",
  options: [
    { value: "migrate:gen", label: "Generate Migration" },
    { value: "migrate:up", label: "Run Migrations" },
  ],
});

if (isCancel(command)) {
  outro("Exiting...");
  process.exit(0);
}

try {
  switch (command) {
    case "migrate:gen":
      await import("../commands/migrate-gen");
      break;
    case "migrate:up":
      await import("../commands/migrate-up");
      break;
  }
  outro(`Command "${command}" executed successfully!`);
  // biome-ignore lint/suspicious/noExplicitAny: <explanation>
} catch (error: any) {
  log.error(`Error executing command "${command}": ${error.message}`);
  outro("GN falhou.");
}

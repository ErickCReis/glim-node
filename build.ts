import dts from "bun-plugin-dts";

await Bun.build({
  entrypoints: ["./src/index.ts", "src/bin/index.ts"],
  outdir: "./dist",
  target: "node",
  format: "esm",
  splitting: true,
  sourcemap: "linked",
  minify: true,
  plugins: [dts()],
});

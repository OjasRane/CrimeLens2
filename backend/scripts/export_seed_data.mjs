import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../..");
const [{ demoInvestigation }, { mumbai2611Investigation }] =
  await Promise.all([
    import(resolve(repositoryRoot, "data/investigations/demo.ts")),
    import(resolve(repositoryRoot, "data/investigations/mumbai2611.ts")),
  ]);

const destination = resolve(
  repositoryRoot,
  "backend/app/db/seeds/investigations.json",
);
const payload = {
  generatedFrom: [
    "data/investigations/demo.ts",
    "data/investigations/mumbai2611.ts",
  ],
  investigations: [demoInvestigation, mumbai2611Investigation],
};

await writeFile(destination, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
process.stdout.write(`Exported authoritative investigation seeds to ${destination}\n`);

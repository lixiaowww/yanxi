import fs from "fs";
import path from "path";

export type DomainFixture = {
  id: string;
  domain: string;
  sourceLabel: string;
  sourceText: string;
  file: string;
};

export function listDomainFixtures(root = process.cwd()): DomainFixture[] {
  const dir = path.join(root, "examples", "domains");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => {
      const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as {
        domain?: string;
        sourceLabel?: string;
        sourceText?: string;
      };
      return {
        id: f.replace(/\.json$/, ""),
        domain: raw.domain || "unknown",
        sourceLabel: raw.sourceLabel || f,
        sourceText: raw.sourceText || "",
        file: `examples/domains/${f}`,
      };
    })
    .filter((d) => d.sourceText.length >= 20)
    .sort((a, b) => a.id.localeCompare(b.id));
}

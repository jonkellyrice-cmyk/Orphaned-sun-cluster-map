import fs from "node:fs";

const path = "tools/generated-maps-phase-2-natural-solid-cartography.mjs";
let source = fs.readFileSync(path, "utf8");
const start = source.indexOf("function summarize(after) {");
const end = source.indexOf("\n\nfunction main()", start);
if (start === -1 || end === -1) throw new Error("Phase 2 summary function boundaries not found");
const replacement = `function summarize(after) {
  const surveys = after.manifest.assets
    .filter((entry) => entry.operationalKind === "natural-solid")
    .map((entry) => JSON.parse(after.files.get(entry.path)).surfaceSurvey);
  const counts = (key) => Object.fromEntries([...new Set(surveys.map((survey) => survey[key]))].sort().map((value) => [value, surveys.filter((survey) => survey[key] === value).length]));
  console.log("[phase-2] surface families: " + JSON.stringify(counts("surfaceFamily")));
  console.log("[phase-2] geologic classes: " + JSON.stringify(counts("activity")));
  console.log("[phase-2] volatile classes: " + JSON.stringify(counts("volatiles")));
  console.log("[phase-2] established exploited surfaces: " + surveys.filter((survey) => survey.exploitation === "established").length + "/" + surveys.length);
}`;
if (!source.includes('established exploited surfaces:')) {
  source = source.slice(0, start) + replacement + source.slice(end);
  fs.writeFileSync(path, source);
  console.log("[phase-2-summary-bootstrap] updated summary for compact materialized surveys");
} else {
  console.log("[phase-2-summary-bootstrap] compact survey summary already present");
}

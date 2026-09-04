import fs from "node:fs";

const path = "tools/phase-2-quality-fix.mjs";
const before = '  source = replaceOnce(source, oldExploit, newExploit, "exploitation evidence");';
const after = '  source = replaceBetween(source, "function exploitationIndex(row) {", "\\n\\nfunction resourceIndex", `${newExploit}\\n\\n`, "exploitation evidence");';
let source = fs.readFileSync(path, "utf8");
if (!source.includes(after)) {
  if (!source.includes(before)) throw new Error("Quality bootstrap exploitation target not found");
  source = source.replace(before, after);
  console.log("[phase-2-quality-bootstrap] made exploitation replacement structural");
}
const diagnosticStart = source.indexOf('  const oldValidate = `');
const diagnosticEndMarker = '  source = replaceOnce(source, oldValidate, newValidate, "migration asset budget guard");\n';
if (diagnosticStart !== -1) {
  const diagnosticEnd = source.indexOf(diagnosticEndMarker, diagnosticStart);
  if (diagnosticEnd === -1) throw new Error("Quality bootstrap diagnostic end not found");
  source = source.slice(0, diagnosticStart) + source.slice(diagnosticEnd + diagnosticEndMarker.length);
  console.log("[phase-2-quality-bootstrap] removed redundant nested migration-size diagnostic");
}
fs.writeFileSync(path, source);

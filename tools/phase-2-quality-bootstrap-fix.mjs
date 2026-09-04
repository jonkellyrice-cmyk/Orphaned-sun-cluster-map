import fs from "node:fs";

const path = "tools/phase-2-quality-fix.mjs";
const before = '  source = replaceOnce(source, oldExploit, newExploit, "exploitation evidence");';
const after = '  source = replaceBetween(source, "function exploitationIndex(row) {", "\\n\\nfunction resourceIndex", `${newExploit}\\n\\n`, "exploitation evidence");';
const source = fs.readFileSync(path, "utf8");
if (source.includes(after)) console.log("[phase-2-quality-bootstrap] structural exploitation replacement already present");
else {
  if (!source.includes(before)) throw new Error("Quality bootstrap target not found");
  fs.writeFileSync(path, source.replace(before, after));
  console.log("[phase-2-quality-bootstrap] made exploitation replacement structural");
}

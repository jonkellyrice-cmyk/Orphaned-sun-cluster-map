import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  AstronomySnapshotCache, orbitalStateAt, rotationStateAt,
} from "../scripts/astronomy.mjs";
import { DAY_MS, UNION_EPOCH_MS } from "../scripts/universal-time.mjs";
import { buildSystemModel, distanceToAu, parseCsv } from "../scripts/system-data.mjs";
import { buildNaturalBodyModel, naturalBodyKind } from "../scripts/natural-body-data.mjs";

const rows = parseCsv(await readFile(new URL("../docs/system-orbital-distances.csv", import.meta.url), "utf8"));
const orientationDocument = JSON.parse(await readFile(new URL("../data/astronomy/epoch-orientations.json", import.meta.url), "utf8"));
const options = (timestamp) => ({ referenceTimestampMs: timestamp, orientations: orientationDocument.orientations });
const angularDifference = (a, b) => Math.abs(((a - b + 540) % 360) - 180);

test("canonical epoch reproduces every established reference phase", () => {
  for (const row of rows) {
    const model = buildSystemModel(rows, row.system, options(UNION_EPOCH_MS));
    const body = model.byName.get(row.object);
    assert.ok(angularDifference(body.phaseDeg, Number(row.reference_phase_deg || 0)) < 1e-8, `${row.system}/${row.object}`);
    if (body.orbitalState.analytical && !body.orbitalState.binaryCompanionOf) {
      const expectedRadius = body.semiMajorAxisAu * (1 - body.orbitalState.eccentricity * Math.cos(body.orbitalState.eccentricAnomalyDeg * Math.PI / 180));
      assert.ok(Math.abs(body.distanceAu - expectedRadius) < 1e-12, `${row.system}/${row.object} radial correction`);
    }
  }
});

test("all canonical orbit hierarchies and ellipse metadata validate", () => {
  for (const system of new Set(rows.map((row) => row.system))) {
    const systemRows = rows.filter((row) => row.system === system);
    const names = new Set(systemRows.map((row) => row.object));
    for (const row of systemRows) {
      if (Number(row.distance_from_parent) > 0) assert.ok(names.has(row.parent), `${system}/${row.object} missing parent ${row.parent}`);
      const eccentricity = Number(row.orbital_eccentricity || 0);
      assert.ok(eccentricity >= 0 && eccentricity < 1, `${system}/${row.object} eccentricity`);
      const period = Number(row.moon_orbital_period_days || row.orbital_period_days || 0);
      if (period) assert.ok(period > 0, `${system}/${row.object} period`);
      const peri = row.periapsis_au ? Number(row.periapsis_au) : row.periapsis_km ? distanceToAu(row.periapsis_km, "km") : null;
      const apo = row.apoapsis_au ? Number(row.apoapsis_au) : row.apoapsis_km ? distanceToAu(row.apoapsis_km, "km") : null;
      if (peri != null && apo != null) {
        assert.ok(peri < apo || eccentricity === 0 && peri === apo, `${system}/${row.object} apsides`);
        const adoptedA = distanceToAu(row.distance_from_parent || 0, row.distance_unit || "AU");
        assert.ok(Math.abs((peri + apo) / 2 - adoptedA) <= Math.max(1e-10, adoptedA * .015), `${system}/${row.object} semi-major axis`);
      }
    }
    const parentByName = new Map(systemRows.map((row) => [row.object, row.parent]));
    for (const row of systemRows) {
      const visited = new Set(); let name = row.object;
      while (parentByName.has(name)) {
        assert.ok(!visited.has(name), `${system}/${row.object} parent cycle`);
        visited.add(name); name = parentByName.get(name);
      }
    }
  }
});

test("fabricated orientations are frozen, provenance-labelled, and irregular", () => {
  const entries = Object.values(orientationDocument.orientations);
  const spins = entries.flatMap((entry) => entry.spinPhaseAtEpochDeg == null ? [] : [entry.spinPhaseAtEpochDeg]);
  assert.equal(entries.length, 83);
  assert.equal(spins.length, 50);
  assert.ok(new Set(spins.map((value) => Math.floor(value / 30))).size >= 10);
  assert.ok(entries.every((entry) => /DETERMINISTIC WORKING CANON/.test(entry.axialSeasonPhaseProvenance)));
  assert.ok(entries.filter((entry) => entry.spinPhaseAtEpochDeg == null).every((entry) => /DERIVED: synchronous tidal lock/.test(entry.spinPhaseProvenance)));
});

test("one period returns to the same phase and half a circular period is opposite", () => {
  const circular = { name: "Test", distanceAu: 1, referencePhaseDeg: 37, inclinationDeg: 4, orbital_eccentricity: 0, orbital_period_days: 200 };
  const epoch = orbitalStateAt(circular, UNION_EPOCH_MS);
  const full = orbitalStateAt(circular, UNION_EPOCH_MS + 200 * DAY_MS);
  const half = orbitalStateAt(circular, UNION_EPOCH_MS + 100 * DAY_MS);
  assert.ok(angularDifference(epoch.trueAnomalyDeg, full.trueAnomalyDeg) < 1e-9);
  assert.ok(Math.abs(angularDifference(epoch.trueAnomalyDeg, half.trueAnomalyDeg) - 180) < 1e-9);
});

test("moon state remains parent-relative while its planet advances", () => {
  const epoch = buildSystemModel(rows, "Abydos", options(UNION_EPOCH_MS));
  const later = buildSystemModel(rows, "Abydos", options(UNION_EPOCH_MS + 100 * DAY_MS));
  const moonName = rows.find((row) => row.system === "Abydos" && row.type.toLowerCase().includes("moon"))?.object;
  const moon0 = epoch.byName.get(moonName), moon1 = later.byName.get(moonName);
  assert.ok(moon0.parentObject && moon1.parentObject);
  const local0 = Math.hypot(moon0.physical.x - moon0.parentObject.physical.x, moon0.physical.y - moon0.parentObject.physical.y, moon0.physical.z - moon0.parentObject.physical.z);
  const local1 = Math.hypot(moon1.physical.x - moon1.parentObject.physical.x, moon1.physical.y - moon1.parentObject.physical.y, moon1.physical.z - moon1.parentObject.physical.z);
  assert.ok(local0 > 0 && local1 > 0);
  assert.notDeepEqual(moon0.parentObject.physical, moon1.parentObject.physical);
});

test("free and tidally locked rotations are analytical", () => {
  const free = { rotation_hours: 31, axial_tilt_deg: 12, tidally_locked: "no" };
  const orientation = { spinPhaseAtEpochDeg: 123.456, axialSeasonPhaseAtEpochDeg: 78 };
  assert.ok(angularDifference(
    rotationStateAt(free, UNION_EPOCH_MS, orientation).rotationDeg,
    rotationStateAt(free, UNION_EPOCH_MS + 31 * 3_600_000, orientation).rotationDeg,
  ) < 1e-9);
  const orbit = { analytical: true, trueAnomalyDeg: 212 };
  const locked = rotationStateAt({ tidally_locked: "yes", axial_tilt_deg: 1 }, UNION_EPOCH_MS, {}, orbit);
  assert.equal(angularDifference(locked.primeMeridianAngleDeg, orbit.trueAnomalyDeg), 180);
  assert.equal(locked.basis, "derived-tidal-lock");
});

test("opening a natural body can consume its coherent system-snapshot rotation", () => {
  const timestamp = UNION_EPOCH_MS + 42 * DAY_MS;
  const system = buildSystemModel(rows, "Thebes", options(timestamp));
  const body = system.objects.find((object) => object.selectable && naturalBodyKind(object));
  const model = buildNaturalBodyModel(body);
  assert.equal(model.astronomy.referenceTimestampMs, timestamp);
  assert.deepEqual(model.astronomy.rotationState, body.rotationState);
});

test("large and backward jumps are direct deterministic evaluations", () => {
  const body = { distanceAu: 2.5, referencePhaseDeg: 190, orbital_eccentricity: .21, orbital_period_days: 912.4 };
  const future = UNION_EPOCH_MS + 10 * 365.25 * DAY_MS;
  assert.deepEqual(orbitalStateAt(body, future), orbitalStateAt(body, future));
  assert.deepEqual(orbitalStateAt(body, UNION_EPOCH_MS - 1234 * DAY_MS), orbitalStateAt(body, UNION_EPOCH_MS - 1234 * DAY_MS));
});

test("Tanis stellar components remain opposite around their barycenter", () => {
  for (const offsetDays of [0, 1, 100, -40]) {
    const model = buildSystemModel(rows, "Tanis", options(UNION_EPOCH_MS + offsetDays * DAY_MS));
    const a = model.byName.get("Tanis A"), b = model.byName.get("Tanis B");
    assert.ok(Math.abs(angularDifference(a.phaseDeg, b.phaseDeg) - 180) < 1e-8);
    assert.equal(b.orbitalState.binaryCompanionOf, "Tanis A");
  }
});

test("snapshot cache reuses exact requests and bounds retained history", () => {
  const cache = new AstronomySnapshotCache(2);
  let calls = 0;
  const first = cache.getOrCreate("Abydos", 10, () => ({ calls: ++calls }));
  assert.strictEqual(cache.getOrCreate("Abydos", 10, () => ({ calls: ++calls })), first);
  cache.getOrCreate("Abydos", 20, () => ({ calls: ++calls }));
  cache.getOrCreate("Thebes", 30, () => ({ calls: ++calls }));
  assert.equal(cache.entries.size, 2);
  assert.equal(cache.get("Abydos", 10), null);
});

test("astronomy remains snapshot-only with no heartbeat or animation loop", async () => {
  const astronomySource = await readFile(new URL("../scripts/astronomy.mjs", import.meta.url), "utf8");
  const appSource = await readFile(new URL("../scripts/cluster-map-app.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(astronomySource, /setInterval|requestAnimationFrame/);
  assert.match(appSource, /#refreshVisibleAstronomy/);
  assert.match(appSource, /#snapshotVoyageArrival/);
  assert.match(appSource, /astronomySnapshotReferenceMs/);
  assert.doesNotMatch(appSource, /_voyageTicker[^;]*#refreshVisibleAstronomy/);
});

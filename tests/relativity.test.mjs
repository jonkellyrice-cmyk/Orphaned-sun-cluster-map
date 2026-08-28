import test from "node:test";
import assert from "node:assert/strict";
import { SYSTEMS, projectedDistanceLy, spatialDistanceLy } from "../scripts/cluster-data.mjs";
import { calculateTransit, lorentzGamma } from "../scripts/relativity.mjs";

const byName = Object.fromEntries(SYSTEMS.map((s) => [s.name, s]));

test("0.995c gamma is about 10.0125", () => {
  assert.ok(Math.abs(lorentzGamma(0.995) - 10.012523) < 1e-5);
});

test("Abydos-Amarna projected and true separation are 15 ly", () => {
  const a = byName.Abydos;
  const b = byName.Amarna;
  assert.ok(Math.abs(projectedDistanceLy(a, b) - 15) < 0.002);
  assert.ok(Math.abs(spatialDistanceLy(a, b) - 15) < 0.002);
});

test("Nekhen-Seti becomes about 2.41 ly with depth", () => {
  const distance = spatialDistanceLy(byName.Nekhen, byName.Seti);
  assert.ok(distance > 2.39 && distance < 2.43);
});

test("200g trip to 0.995c reaches cap across campaign routes", () => {
  const transit = calculateTransit(spatialDistanceLy(byName.Nekhen, byName.Seti), {
    accelerationG: 200,
    cruiseBeta: 0.995,
  });
  assert.equal(transit.reachesCruise, true);
  assert.ok(transit.shipYears > 0.25 && transit.shipYears < 0.28);
  assert.ok(transit.clusterYears > 2.4 && transit.clusterYears < 2.5);
});

test("very short route flips before reaching cruise cap", () => {
  const transit = calculateTransit(0.01, { accelerationG: 200, cruiseBeta: 0.995 });
  assert.equal(transit.reachesCruise, false);
  assert.ok(transit.peakBeta < 0.995);
});

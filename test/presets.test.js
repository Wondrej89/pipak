import test from "node:test";
import assert from "node:assert/strict";
import { movePreset } from "../src/presets.js";

test("moves a preset up and down", () => {
  const presets = [{ id: "a" }, { id: "b" }, { id: "c" }];
  assert.equal(movePreset(presets, "b", -1), true);
  assert.deepEqual(presets.map(preset => preset.id), ["b", "a", "c"]);
  assert.equal(movePreset(presets, "b", 1), true);
  assert.deepEqual(presets.map(preset => preset.id), ["a", "b", "c"]);
});

test("does not move a preset past a list boundary", () => {
  const presets = [{ id: "a" }, { id: "b" }];
  assert.equal(movePreset(presets, "a", -1), false);
  assert.equal(movePreset(presets, "b", 1), false);
  assert.equal(movePreset(presets, "missing", 1), false);
  assert.deepEqual(presets.map(preset => preset.id), ["a", "b"]);
});

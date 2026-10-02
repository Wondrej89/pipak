import test from "node:test";
import assert from "node:assert/strict";
import { Storage } from "../src/storage.js";

test("active workout session can be saved, loaded and explicitly cleared", () => {
  const values = new Map();
  globalThis.localStorage = { getItem:key=>values.get(key)??null, setItem:(key,value)=>values.set(key,value), removeItem:key=>values.delete(key) };
  const storage = new Storage(), session = { preset: { id: "hiit" }, timer: { state: "WORK" }, savedAt: 123 };
  storage.saveActiveWorkout(session);
  assert.deepEqual(storage.loadActiveWorkout(), session);
  storage.clearActiveWorkout();
  assert.equal(storage.loadActiveWorkout(), null);
});

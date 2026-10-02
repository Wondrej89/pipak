import test from "node:test";
import assert from "node:assert/strict";
import { makeQuietWav } from "../src/background-media.js";

test("generated carrier contains real non-zero PCM samples", async () => {
  const original = URL.createObjectURL;
  let wav;
  URL.createObjectURL = blob => { wav = blob; return "blob:test"; };
  try { assert.equal(makeQuietWav(), "blob:test"); } finally { URL.createObjectURL = original; }
  const bytes = new Uint8Array(await wav.arrayBuffer());
  assert.equal(new TextDecoder().decode(bytes.slice(0, 4)), "RIFF");
  assert.ok(bytes.slice(44).some(byte => byte !== 0), "PCM payload must not be digital silence");
});

export function movePreset(presets, id, offset) {
  const from = presets.findIndex(preset => preset.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= presets.length) return false;
  const [preset] = presets.splice(from, 1);
  presets.splice(to, 0, preset);
  return true;
}

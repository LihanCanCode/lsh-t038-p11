// Skills are an open, data-driven vocabulary (never a fixed enum) — derive a
// stable hue from the string itself instead of switching on known names.
// Saturation/lightness are pinned so every skill reads as a soft tint from
// the same muted family, keeping the UI within its 3-4 color palette rather
// than turning into a rainbow of fully-saturated hues.
function skillHash(skill: string): number {
  let hash = 0;
  for (let i = 0; i < skill.length; i++) {
    hash = skill.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function skillColor(skill: string): string {
  return `hsl(${skillHash(skill)}, 50%, 36%)`;
}

export function skillTint(skill: string): string {
  return `hsl(${skillHash(skill)}, 60%, 91%)`;
}

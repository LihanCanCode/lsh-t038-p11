// Skills are an open, data-driven vocabulary (never a fixed enum) — derive a
// stable color from the string itself instead of switching on known names.
export function skillColor(skill: string): string {
  let hash = 0;
  for (let i = 0; i < skill.length; i++) {
    hash = skill.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 62%, 45%)`;
}

export const SECTION_TYPES = [
  { value: "verse", label: "Verse" },
  { value: "chorus", label: "Chorus" },
  { value: "pre_chorus", label: "Pre-Chorus" },
  { value: "bridge", label: "Bridge" },
  { value: "refrain", label: "Refrain" },
  { value: "tag", label: "Tag" },
  { value: "intro", label: "Intro" },
  { value: "ending", label: "Ending" },
] as const;

export function chipClass(type: string): string {
  const known = ["verse", "chorus", "bridge", "pre_chorus", "tag", "refrain", "intro", "ending"];
  const t = known.includes(type) ? type : "intro";
  return `chip-${t}`;
}

import { skillColor } from "@/lib/ui/skillColor";

export default function SkillLegend({ skills }: { skills: string[] }) {
  if (skills.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
      {skills.map((skill) => (
        <span key={skill} className="flex items-center gap-1.5 text-xs font-medium text-stone-500">
          <span
            className="h-2.5 w-2.5 rounded-full ring-1 ring-black/5"
            style={{ backgroundColor: skillColor(skill) }}
          />
          {skill}
        </span>
      ))}
    </div>
  );
}

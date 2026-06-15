import type { KeywordGroups } from "@/lib/types";

interface KeywordSettingsProps {
  keywordGroups: KeywordGroups;
  onChange: (groups: KeywordGroups) => void;
}

const GROUP_LABELS: { key: keyof KeywordGroups; label: string; description: string }[] = [
  {
    key: "coreBrandKeywords",
    label: "Core brand keywords",
    description: "Decentralized compute / DePIN terms — drive the highest topic relevance.",
  },
  {
    key: "marketKeywords",
    label: "Market keywords",
    description: "Broader AI / GPU / cloud infrastructure terms.",
  },
  {
    key: "opportunityTriggerKeywords",
    label: "Opportunity trigger keywords",
    description: "Pain points, comparisons, and debate signals that invite a reply.",
  },
  {
    key: "riskKeywords",
    label: "Risk keywords",
    description: "Spam, hype, or unsafe content signals that lower the score.",
  },
];

function keywordsToText(keywords: string[]): string {
  return keywords.join(", ");
}

function textToKeywords(text: string): string[] {
  return text
    .split(",")
    .map((k) => k.trim())
    .filter((k) => k.length > 0);
}

export function KeywordSettings({ keywordGroups, onChange }: KeywordSettingsProps) {
  return (
    <div className="mt-3">
      <p className="text-sm text-slate-500">
        These keyword groups drive the scoring model. Edit them to tune relevance for your account —
        changes apply immediately to the current results.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {GROUP_LABELS.map(({ key, label, description }) => (
          <div key={key} className="flex flex-col">
            <label className="text-sm font-medium text-slate-300">{label}</label>
            <p className="mb-2 text-xs text-slate-500">{description}</p>
            <textarea
              value={keywordsToText(keywordGroups[key])}
              onChange={(e) =>
                onChange({
                  ...keywordGroups,
                  [key]: textToKeywords(e.target.value),
                })
              }
              spellCheck={false}
              className="h-24 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-2 font-mono text-xs text-slate-300 focus:border-cyan-500 focus:outline-none"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

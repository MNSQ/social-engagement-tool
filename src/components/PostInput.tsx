const EXAMPLE_JSON = `[
  {
    "id": "post-101",
    "authorName": "Jane Doe",
    "handle": "@jane_ai",
    "text": "Why is GPU access still this hard in 2026?",
    "url": "https://x.com/jane_ai/status/1234567890",
    "createdAt": "2026-06-14T12:00:00.000Z",
    "likes": 120,
    "replies": 18,
    "reposts": 9,
    "views": 8400,
    "followers": 5200
  }
]`;

interface PostInputProps {
  value: string;
  onChange: (value: string) => void;
  onAnalyze: () => void;
  onLoadSample: () => void;
  error: string | null;
}

export function PostInput({ value, onChange, onAnalyze, onLoadSample, error }: PostInputProps) {
  return (
    <div className="mt-3">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-400">
          Paste an array of X posts as JSON, or load sample data to try the scanner.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-slate-700"
          >
            Load sample posts
          </button>
          <button
            type="button"
            onClick={onAnalyze}
            className="rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-400"
          >
            Analyze JSON
          </button>
        </div>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="Paste a JSON array of posts here..."
        className="mt-4 h-48 w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-3 font-mono text-sm text-slate-200 placeholder:text-slate-600 focus:border-cyan-500 focus:outline-none"
      />

      {error && (
        <p className="mt-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <details className="mt-4 rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-slate-400">
        <summary className="cursor-pointer font-medium text-slate-300">Expected JSON format</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre rounded-lg bg-slate-950 p-3 font-mono text-xs text-slate-400">
          {EXAMPLE_JSON}
        </pre>
        <p className="mt-2 text-xs text-slate-500">
          <code className="text-slate-400">id</code> and <code className="text-slate-400">followers</code> are
          optional — an id is generated automatically if missing.
        </p>
      </details>
    </div>
  );
}

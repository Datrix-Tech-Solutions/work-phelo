import { Construction } from 'lucide-react';

interface ComingSoonProps {
  section: string;
  description?: string;
}

export function ComingSoon({ section, description }: ComingSoonProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <Construction className="h-8 w-8" />
      </span>
      <div className="max-w-sm">
        <h2 className="text-lg font-semibold text-slate-800">{section}</h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {description ?? 'This section is under active development and will be available soon.'}
        </p>
      </div>
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
        Coming soon
      </span>
    </div>
  );
}

interface FilterSelectProps {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}

export function FilterSelect({ value, onChange, options, placeholder }: FilterSelectProps) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 px-3 border border-gray-200 rounded-input text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0D2244]/20 focus:border-[#0D2244]"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export default function FeedTabs({ value, onChange }) {
  const tabs = [
    { id: 'following', label: 'Following' },
    { id: 'global', label: 'Global' },
  ];
  return (
    <div className="flex gap-8 border-b border-slate-200/80 dark:border-slate-800/80">
      {tabs.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={`relative pb-3 text-sm font-semibold transition-colors duration-motion ease-motion-standard ${
              active ? 'text-slate-900 dark:text-white' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span
              className={`absolute bottom-0 left-0 right-0 h-0.5 origin-left rounded-full bg-blue-500 transition-transform duration-motion ease-motion-standard ${
                active ? 'scale-x-100' : 'scale-x-0'
              }`}
              aria-hidden
            />
          </button>
        );
      })}
    </div>
  );
}

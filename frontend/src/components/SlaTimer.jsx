import { useEffect, useState } from 'react';

function format(ms) {
  if (ms <= 0) return 'Overdue';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return `${String(h).padStart(2, '0')}h ${String(m).padStart(2, '0')}m`;
}

export default function SlaTimer({ deadline, createdAt, showBar = false }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const end = new Date(deadline).getTime();
  const start = new Date(createdAt).getTime();
  const left = end - now;
  const percent = Math.min(100, Math.max(0, ((now - start) / (end - start)) * 100));
  const color = left <= 0 ? 'text-red-700' : left < 3600000 ? 'text-orange-600' : 'text-green-700';

  return (
    <div>
      <span className={`font-semibold ${color}`}>{format(left)}</span>
      {showBar && (
        <div className="mt-2 h-2 w-full rounded bg-gray-200">
          <div className="h-2 rounded bg-[#7a1620]" style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
}
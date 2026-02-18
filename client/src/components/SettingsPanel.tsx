import type { UserSettings, Gender, PreferredGender } from '../hooks/useSettings';

const COUNTRIES = [
  { code: '', label: 'Anywhere' },
  { code: 'AR', label: 'Argentina' },
  { code: 'AU', label: 'Australia' },
  { code: 'AT', label: 'Austria' },
  { code: 'BE', label: 'Belgium' },
  { code: 'BR', label: 'Brazil' },
  { code: 'CA', label: 'Canada' },
  { code: 'CL', label: 'Chile' },
  { code: 'CN', label: 'China' },
  { code: 'CO', label: 'Colombia' },
  { code: 'HR', label: 'Croatia' },
  { code: 'CZ', label: 'Czech Republic' },
  { code: 'DK', label: 'Denmark' },
  { code: 'EG', label: 'Egypt' },
  { code: 'FI', label: 'Finland' },
  { code: 'FR', label: 'France' },
  { code: 'DE', label: 'Germany' },
  { code: 'GR', label: 'Greece' },
  { code: 'HU', label: 'Hungary' },
  { code: 'IN', label: 'India' },
  { code: 'ID', label: 'Indonesia' },
  { code: 'IE', label: 'Ireland' },
  { code: 'IL', label: 'Israel' },
  { code: 'IT', label: 'Italy' },
  { code: 'JP', label: 'Japan' },
  { code: 'KR', label: 'South Korea' },
  { code: 'MX', label: 'Mexico' },
  { code: 'NL', label: 'Netherlands' },
  { code: 'NZ', label: 'New Zealand' },
  { code: 'NG', label: 'Nigeria' },
  { code: 'NO', label: 'Norway' },
  { code: 'PK', label: 'Pakistan' },
  { code: 'PE', label: 'Peru' },
  { code: 'PH', label: 'Philippines' },
  { code: 'PL', label: 'Poland' },
  { code: 'PT', label: 'Portugal' },
  { code: 'RO', label: 'Romania' },
  { code: 'RU', label: 'Russia' },
  { code: 'SA', label: 'Saudi Arabia' },
  { code: 'ZA', label: 'South Africa' },
  { code: 'ES', label: 'Spain' },
  { code: 'SE', label: 'Sweden' },
  { code: 'CH', label: 'Switzerland' },
  { code: 'TW', label: 'Taiwan' },
  { code: 'TH', label: 'Thailand' },
  { code: 'TR', label: 'Turkey' },
  { code: 'UA', label: 'Ukraine' },
  { code: 'AE', label: 'UAE' },
  { code: 'GB', label: 'United Kingdom' },
  { code: 'US', label: 'United States' },
  { code: 'VN', label: 'Vietnam' },
];

interface SettingsPanelProps {
  settings: UserSettings;
  onUpdate: (patch: Partial<UserSettings>) => void;
  onClose: () => void;
}

function GenderBtn({
  value,
  current,
  label,
  onClick,
}: {
  value: string;
  current: string;
  label: string;
  onClick: () => void;
}) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
        active
          ? 'btn-gradient text-white'
          : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
      }`}
    >
      {label}
    </button>
  );
}

export default function SettingsPanel({ settings, onUpdate, onClose }: SettingsPanelProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-md glow-purple relative">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors text-lg leading-none"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="text-white font-semibold text-lg mb-5">Preferences</h2>

        {/* My Gender */}
        <div className="mb-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">I am</p>
          <div className="flex gap-2">
            <GenderBtn value="male" current={settings.gender} label="Male" onClick={() => onUpdate({ gender: 'male' as Gender })} />
            <GenderBtn value="female" current={settings.gender} label="Female" onClick={() => onUpdate({ gender: 'female' as Gender })} />
            <GenderBtn value="other" current={settings.gender} label="Other" onClick={() => onUpdate({ gender: 'other' as Gender })} />
            <GenderBtn value="" current={settings.gender} label="Skip" onClick={() => onUpdate({ gender: '' as Gender })} />
          </div>
        </div>

        {/* Partner Gender */}
        <div className="mb-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Looking for</p>
          <div className="flex gap-2">
            <GenderBtn value="male" current={settings.preferredGender} label="Male" onClick={() => onUpdate({ preferredGender: 'male' as PreferredGender })} />
            <GenderBtn value="female" current={settings.preferredGender} label="Female" onClick={() => onUpdate({ preferredGender: 'female' as PreferredGender })} />
            <GenderBtn value="any" current={settings.preferredGender} label="Anyone" onClick={() => onUpdate({ preferredGender: 'any' as PreferredGender })} />
          </div>
        </div>

        {/* Country */}
        <div className="mb-6">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Country</p>
          <select
            value={settings.country}
            onChange={(e) => onUpdate({ country: e.target.value })}
            className="w-full px-3 py-2 bg-white/5 text-white text-sm rounded-lg border border-white/10 focus:border-violet-500 focus:outline-none"
          >
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code} className="bg-slate-900 text-white">
                {c.label}
              </option>
            ))}
          </select>
          {settings.country === '' && (
            <p className="text-slate-500 text-xs mt-1">
              Matching with people from all countries
            </p>
          )}
        </div>

        <button
          onClick={onClose}
          className="w-full py-2 btn-gradient text-white rounded-lg text-sm font-semibold"
        >
          Save & Close
        </button>
      </div>
    </div>
  );
}

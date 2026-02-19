import type { UserSettings, Gender, PreferredGender, EnergyLevel, Intent } from '../hooks/useSettings';
import { useFeatures } from '../context/FeaturesContext';

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
  onLogout: () => void;
}

function OptionBtn({
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

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div>
        <p className="text-sm text-slate-200">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ml-4 ${
          checked ? 'bg-violet-600' : 'bg-white/15'
        }`}
        aria-label={label}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function SettingsPanel({ settings, onUpdate, onClose, onLogout }: SettingsPanelProps) {
  const features = useFeatures();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="glass rounded-2xl p-6 w-full max-w-md glow-purple relative max-h-[90vh] overflow-y-auto">
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
            <OptionBtn value="male"   current={settings.gender} label="Male"   onClick={() => onUpdate({ gender: 'male'   as Gender })} />
            <OptionBtn value="female" current={settings.gender} label="Female" onClick={() => onUpdate({ gender: 'female' as Gender })} />
            <OptionBtn value="other"  current={settings.gender} label="Other"  onClick={() => onUpdate({ gender: 'other'  as Gender })} />
            <OptionBtn value=""       current={settings.gender} label="Skip"   onClick={() => onUpdate({ gender: ''       as Gender })} />
          </div>
        </div>

        {/* Partner Gender */}
        <div className="mb-5">
          <p className="text-slate-400 text-xs uppercase tracking-wider mb-2">Looking for</p>
          <div className="flex gap-2">
            <OptionBtn value="male"   current={settings.preferredGender} label="Male"   onClick={() => onUpdate({ preferredGender: 'male'   as PreferredGender })} />
            <OptionBtn value="female" current={settings.preferredGender} label="Female" onClick={() => onUpdate({ preferredGender: 'female' as PreferredGender })} />
            <OptionBtn value="any"    current={settings.preferredGender} label="Anyone" onClick={() => onUpdate({ preferredGender: 'any'    as PreferredGender })} />
          </div>
        </div>

        {/* Country */}
        <div className="mb-5">
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
            <p className="text-slate-500 text-xs mt-1">Matching with people from all countries</p>
          )}
        </div>

        {/* Phase 2: Smart Match Preferences (shown only when flag enabled) */}
        {features.smartMatch && (
          <>
            <div className="border-t border-white/10 pt-5 mb-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-1">Vibe</p>
              <p className="text-slate-500 text-xs mb-3">Soft preference — you'll still match with everyone</p>
              <div className="flex gap-2">
                <OptionBtn value="chill"  current={settings.energyLevel} label="Chill"  onClick={() => onUpdate({ energyLevel: 'chill'  as EnergyLevel })} />
                <OptionBtn value="normal" current={settings.energyLevel} label="Normal" onClick={() => onUpdate({ energyLevel: 'normal' as EnergyLevel })} />
                <OptionBtn value="hype"   current={settings.energyLevel} label="Hype"   onClick={() => onUpdate({ energyLevel: 'hype'   as EnergyLevel })} />
                <OptionBtn value=""       current={settings.energyLevel} label="Any"    onClick={() => onUpdate({ energyLevel: ''       as EnergyLevel })} />
              </div>
            </div>

            <div className="mb-5">
              <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">I want to</p>
              <div className="flex gap-2 flex-wrap">
                <OptionBtn value="talk"  current={settings.intent} label="Talk"  onClick={() => onUpdate({ intent: 'talk'  as Intent })} />
                <OptionBtn value="play"  current={settings.intent} label="Play"  onClick={() => onUpdate({ intent: 'play'  as Intent })} />
                <OptionBtn value="learn" current={settings.intent} label="Learn" onClick={() => onUpdate({ intent: 'learn' as Intent })} />
                <OptionBtn value=""      current={settings.intent} label="Any"   onClick={() => onUpdate({ intent: ''      as Intent })} />
              </div>
            </div>
          </>
        )}

        {/* Phase 6: Privacy Controls (shown only when flag enabled) */}
        {features.identityControls && (
          <div className="border-t border-white/10 pt-5 mb-5">
            <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">Privacy</p>
            <Toggle
              checked={settings.faceBlur}
              onChange={(v) => onUpdate({ faceBlur: v })}
              label="Face blur"
              description="Blur your video before connecting"
            />
            <Toggle
              checked={settings.voiceOnly}
              onChange={(v) => onUpdate({ voiceOnly: v, faceBlur: v ? true : settings.faceBlur })}
              label="Voice only"
              description="Disable your camera entirely"
            />
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full py-2 btn-gradient text-white rounded-lg text-sm font-semibold mb-3"
        >
          Save & Close
        </button>

        {/* Logout */}
        <button
          onClick={onLogout}
          className="w-full py-2 bg-white/5 hover:bg-red-600/20 text-slate-400 hover:text-red-400 rounded-lg text-sm border border-white/10 hover:border-red-600/30 transition-all"
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

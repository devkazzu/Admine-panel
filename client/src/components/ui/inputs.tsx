/**
 * Composite form inputs: tag list, social links, key/value statistics,
 * skills, and image picker (media library).
 */
import { ImagePlus, Plus, Trash2, X } from 'lucide-react';
import { useState } from 'react';
import { Button, FormField, Input, Select } from './primitives';
import { MediaPicker } from './MediaPicker';
import { PLATFORMS } from '../../lib/constants';

// ── Tag list (technologies, interests) ───────────────────────────────────────
export function TagInput({
  value,
  onChange,
  placeholder = 'Add and press Enter',
  max = 20,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  max?: number;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v) && value.length < max) onChange([...value, v]);
    setDraft('');
  };
  return (
    <div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
        />
        <Button type="button" variant="outline" size="md" onClick={add} disabled={!draft.trim() || value.length >= max}>
          <Plus size={14} /> Add
        </Button>
      </div>
      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-md bg-violet-500/10 px-2 py-1 text-xs text-violet-300 ring-1 ring-inset ring-violet-500/25"
            >
              {tag}
              <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="hover:text-white">
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Social links ({platform: url}) ───────────────────────────────────────────
export function SocialLinksInput({
  value,
  onChange,
}: {
  value: Partial<Record<string, string>>;
  onChange: (value: Partial<Record<string, string>>) => void;
}) {
  const entries = Object.entries(value ?? {});
  const set = (platform: string, url: string) => onChange({ ...value, [platform]: url });
  const remove = (platform: string) => {
    const next = { ...value };
    delete (next as any)[platform];
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {entries.length === 0 && <p className="text-xs text-zinc-600">No social links configured.</p>}
      {entries.map(([platform, url]) => (
        <div key={platform} className="flex items-center gap-2">
          <Select value={platform} onChange={(e) => { remove(platform); set(e.target.value, url ?? ''); }} className="w-36 shrink-0">
            {PLATFORMS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <Input value={url ?? ''} onChange={(e) => set(platform, e.target.value)} placeholder="https://…" />
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(platform)} aria-label="Remove link">
            <Trash2 size={14} className="text-rose-400" />
          </Button>
        </div>
      ))}
      {entries.length < PLATFORMS.length && (
        <Button type="button" size="sm" variant="outline" onClick={() => {
          const used = new Set(entries.map(([p]) => p));
          const free = PLATFORMS.find((p) => !used.has(p.value));
          if (free) onChange({ ...value, [free.value]: '' });
        }}>
          <Plus size={13} /> Add platform
        </Button>
      )}
    </div>
  );
}

// ── Key/value statistics (manually configurable) ─────────────────────────────
export function StatsInput({
  value,
  onChange,
  labelName = 'Label',
  valueName = 'Value',
}: {
  value: { label: string; value: string }[];
  onChange: (value: { label: string; value: string }[]) => void;
  labelName?: string;
  valueName?: string;
}) {
  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-xs text-zinc-600">No statistics configured — add them manually.</p>}
      {value.map((stat, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={stat.label}
            onChange={(e) => onChange(value.map((s, j) => (i === j ? { ...s, label: e.target.value } : s)))}
            placeholder={labelName}
            className="w-40 shrink-0"
          />
          <Input
            value={stat.value}
            onChange={(e) => onChange(value.map((s, j) => (i === j ? { ...s, value: e.target.value } : s)))}
            placeholder={valueName}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove stat">
            <Trash2 size={14} className="text-rose-400" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { label: '', value: '' }])}>
        <Plus size={13} /> Add statistic
      </Button>
    </div>
  );
}

// ── Skills (name + level 0-100) ──────────────────────────────────────────────
export function SkillsInput({
  value,
  onChange,
}: {
  value: { name: string; level: number }[];
  onChange: (value: { name: string; level: number }[]) => void;
}) {
  return (
    <div className="space-y-2">
      {value.length === 0 && <p className="text-xs text-zinc-600">No skills configured.</p>}
      {value.map((skill, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={skill.name}
            onChange={(e) => onChange(value.map((s, j) => (i === j ? { ...s, name: e.target.value } : s)))}
            placeholder="Skill name"
          />
          <Input
            type="number"
            min={0}
            max={100}
            value={skill.level}
            onChange={(e) => onChange(value.map((s, j) => (i === j ? { ...s, level: Number(e.target.value) } : s)))}
            className="w-24 shrink-0"
            aria-label="Level"
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove skill">
            <Trash2 size={14} className="text-rose-400" />
          </Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => onChange([...value, { name: '', level: 60 }])}>
        <Plus size={13} /> Add skill
      </Button>
    </div>
  );
}

// ── Image picker (media library + manual URL) ────────────────────────────────
export function ImageInput({
  value,
  onChange,
  label,
  error,
  help,
  circular,
}: {
  value: string;
  onChange: (value: string) => void;
  label?: string;
  error?: string;
  help?: string;
  circular?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <FormField label={label} error={error} help={help}>
      <div className="flex items-start gap-3">
        <div
          className={`flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden border border-dashed border-white/15 bg-zinc-950/60 ${
            circular ? 'rounded-full h-20 w-20' : 'rounded-lg'
          }`}
        >
          {value ? (
            <img src={value} alt="" className="h-full w-full object-cover" onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')} />
          ) : (
            <ImagePlus size={20} className="text-zinc-600" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/uploads/… or https://…" invalid={!!error} />
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setPickerOpen(true)}>
              <ImagePlus size={13} /> Choose from library
            </Button>
            {value && (
              <Button type="button" size="sm" variant="ghost" onClick={() => onChange('')}>
                Clear
              </Button>
            )}
          </div>
        </div>
      </div>
      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onSelect={(path) => { onChange(path); setPickerOpen(false); }} />
    </FormField>
  );
}

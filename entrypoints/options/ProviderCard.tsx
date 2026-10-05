import { useEffect, useState, type FormEvent } from 'react';
import { CheckCircle2, Eye, EyeOff, Loader2, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSettings } from '@/hooks/useData';
import { saveSettings } from '@/lib/db';
import type { ProviderId } from '@/lib/providers/common';
import { listModels, type ModelOption } from '@/lib/providers/models';

type KeyField = 'geminiKey' | 'openaiKey';
type Check = { state: 'idle' } | { state: 'checking' } | { state: 'ok'; models: ModelOption[] } | { state: 'error'; message: string };

const PROVIDERS: { id: ProviderId; name: string; keyField: KeyField; keyUrl: string; hint: string }[] = [
  { id: 'gemini', name: 'Google Gemini', keyField: 'geminiKey', keyUrl: 'https://aistudio.google.com/apikey', hint: 'Recommended. Best at keeping your face and body unchanged.' },
  { id: 'openai', name: 'OpenAI', keyField: 'openaiKey', keyUrl: 'https://platform.openai.com/api-keys', hint: 'High quality, slower and more expensive per image.' },
];

const optionValue = (provider: ProviderId, id: string) => `${provider}:${id}`;

function KeyStatus({ check }: { check: Check }) {
  if (check.state === 'checking') {
    return (
      <p className="text-muted-foreground flex items-center gap-1 text-xs">
        <Loader2 className="size-3 animate-spin" /> Checking key…
      </p>
    );
  }
  if (check.state === 'ok') {
    const n = check.models.length;
    return (
      <p className="flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
        <CheckCircle2 className="size-3" /> {n ? `Key works · ${n} image model${n === 1 ? '' : 's'}` : 'Key works, but it has no image models available'}
      </p>
    );
  }
  if (check.state === 'error') {
    return (
      <p className="text-destructive flex items-center gap-1 text-xs" role="alert">
        <XCircle className="size-3" /> {check.message}
      </p>
    );
  }
  return null;
}

export function ProviderCard() {
  const settings = useSettings();
  const [keys, setKeys] = useState<Record<KeyField, string> | null>(null);
  const [checks, setChecks] = useState<Record<ProviderId, Check>>({ gemini: { state: 'idle' }, openai: { state: 'idle' } });
  const [showKeys, setShowKeys] = useState(false);

  async function verify(provider: ProviderId, key: string): Promise<ModelOption[]> {
    if (!key) {
      setChecks((c) => ({ ...c, [provider]: { state: 'idle' } }));
      return [];
    }
    setChecks((c) => ({ ...c, [provider]: { state: 'checking' } }));
    try {
      const models = await listModels(provider, key);
      setChecks((c) => ({ ...c, [provider]: { state: 'ok', models } }));
      return models;
    } catch (e) {
      setChecks((c) => ({ ...c, [provider]: { state: 'error', message: e instanceof Error ? e.message : 'Could not check this key.' } }));
      return [];
    }
  }

  // Load saved keys once and verify them so the model list is filled.
  useEffect(() => {
    if (!settings || keys) return;
    setKeys({ geminiKey: settings.geminiKey, openaiKey: settings.openaiKey });
    for (const p of PROVIDERS) void verify(p.id, settings[p.keyField]);
  }, [settings, keys]);

  if (!settings || !keys) return null;

  const selectedId = settings.provider === 'gemini' ? settings.geminiModel : settings.openaiModel;

  async function selectModel(provider: ProviderId, id: string) {
    await saveSettings(provider === 'gemini' ? { provider, geminiModel: id } : { provider, openaiModel: id });
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!keys || !settings) return;
    const trimmed = { geminiKey: keys.geminiKey.trim(), openaiKey: keys.openaiKey.trim() };
    setKeys(trimmed);
    await saveSettings(trimmed);
    const [gemini, openai] = await Promise.all(PROVIDERS.map((p) => verify(p.id, trimmed[p.keyField])));
    const available: Record<ProviderId, ModelOption[]> = { gemini: gemini ?? [], openai: openai ?? [] };
    // Keep the current choice if it is still offered; otherwise pick the first available model.
    if (!available[settings.provider].some((m) => m.id === selectedId)) {
      const first = [...available[settings.provider], ...available.gemini, ...available.openai][0];
      if (first) await selectModel(first.provider, first.id);
    }
  }

  const groups = PROVIDERS.map((p) => {
    const check = checks[p.id];
    const models = check.state === 'ok' ? check.models : [];
    // Keep the saved choice visible even if it could not be listed (offline, rate limited).
    const keepSelected = p.id === settings.provider && settings[p.keyField] && !models.some((m) => m.id === selectedId);
    return { ...p, models: keepSelected ? [{ provider: p.id, id: selectedId, label: selectedId }, ...models] : models };
  }).filter((g) => g.models.length > 0);

  const checking = checks.gemini.state === 'checking' || checks.openai.state === 'checking';

  return (
    <Card>
      <form onSubmit={(e) => void onSubmit(e)}>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>Add one or both keys. Each key is stored only in this browser and sent only to its own provider.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 pt-4">
          {PROVIDERS.map((p) => (
            <div key={p.id} className="grid gap-2">
              <div className="flex items-baseline justify-between gap-2">
                <Label htmlFor={p.keyField}>{p.name} API key</Label>
                <a className="text-muted-foreground text-xs underline" href={p.keyUrl} target="_blank" rel="noreferrer">
                  Get a key
                </a>
              </div>
              <div className="flex gap-2">
                <Input
                  id={p.keyField}
                  type={showKeys ? 'text' : 'password'}
                  autoComplete="off"
                  spellCheck={false}
                  value={keys[p.keyField]}
                  onChange={(e) => setKeys({ ...keys, [p.keyField]: e.target.value })}
                  placeholder="Paste your API key"
                />
                <Button type="button" variant="outline" size="icon" aria-label={showKeys ? 'Hide keys' : 'Show keys'} onClick={() => setShowKeys(!showKeys)}>
                  {showKeys ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </Button>
              </div>
              <p className="text-muted-foreground text-xs">{p.hint}</p>
              <KeyStatus check={checks[p.id]} />
            </div>
          ))}
          <div className="grid gap-2">
            <Label htmlFor="model">Image model</Label>
            <Select
              value={groups.length ? optionValue(settings.provider, selectedId) : undefined}
              onValueChange={(v) => {
                const [provider, ...rest] = v.split(':');
                void selectModel(provider as ProviderId, rest.join(':'));
              }}
              disabled={groups.length === 0}
            >
              <SelectTrigger id="model" className="w-full">
                <SelectValue placeholder="Save a working key to load models" />
              </SelectTrigger>
              <SelectContent>
                {groups.map((g) => (
                  <SelectGroup key={g.id}>
                    <SelectLabel>{g.name}</SelectLabel>
                    {g.models.map((m) => (
                      <SelectItem key={m.id} value={optionValue(g.id, m.id)}>
                        {m.label}
                        {m.label !== m.id && <span className="text-muted-foreground ml-1 text-xs">{m.id}</span>}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            <p className="text-muted-foreground text-xs">Only models that can edit a photo are listed. Try-ons use the selected model's provider.</p>
          </div>
        </CardContent>
        <CardFooter className="justify-end pt-4">
          <Button type="submit" disabled={checking}>
            {checking && <Loader2 className="size-4 animate-spin" />} Save and verify keys
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}

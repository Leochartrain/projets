import { useState, type FormEvent } from 'react';
import type { MembershipSettings } from '@shared/domain';
import { api, errorText, useSave, useSettings } from '@/api';
import { currentYear } from '@/components/membership';
import { Button, Card, ErrorBox, PageHeader, Spinner, TextArea, TextField } from '@/components/ui';
import { parseDecimal } from '@/format';

export function SettingsPage() {
  const { data: settings, isPending, error } = useSettings();
  return (
    <>
      <PageHeader title="Réglages" subtitle="Les règles de l'association, utilisées à l'accueil et sur la page de réservation." />
      {isPending && <Spinner />}
      {error && <ErrorBox>{errorText(error)}</ErrorBox>}
      {settings && <MembershipSettingsForm key={JSON.stringify(settings)} settings={settings} />}
    </>
  );
}

const toEuros = (cents: number) => (cents / 100).toString().replace('.', ',');

function MembershipSettingsForm({ settings }: { settings: MembershipSettings }) {
  const [reduced, setReduced] = useState(toEuros(settings.reducedCents));
  const [standard, setStandard] = useState(toEuros(settings.standardCents));
  const [towns, setTowns] = useState(settings.reducedTowns.join('\n'));
  const [saved, setSaved] = useState(false);
  const save = useSave(() =>
    api.put<MembershipSettings>('/settings', {
      reducedCents: Math.round((parseDecimal(reduced) ?? 0) * 100),
      standardCents: Math.round((parseDecimal(standard) ?? 0) * 100),
      reducedTowns: towns
        .split(/[\n,;]/)
        .map((t) => t.trim())
        .filter(Boolean),
    }),
  );

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    setSaved(true);
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={submit} onChange={() => setSaved(false)} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg">Adhésion annuelle</h2>
          <p className="text-sm text-muted">
            Obligatoire pour faire réparer un objet. Elle vaut pour l'année civile ({currentYear()} : du 1<sup>er</sup> janvier au 31 décembre) et se règle à l'accueil.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Tarif réduit (€)" inputMode="decimal" required value={reduced} onChange={(e) => setReduced(e.target.value)} />
          <TextField label="Tarif normal (€)" inputMode="decimal" required value={standard} onChange={(e) => setStandard(e.target.value)} />
        </div>
        <TextArea
          label="Communes au tarif réduit"
          rows={8}
          hint="Une commune par ligne. Les accents, majuscules, tirets et « St » / « Saint » ne comptent pas. Les habitants des autres communes paient le tarif normal."
          value={towns}
          onChange={(e) => setTowns(e.target.value)}
        />
        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        <div className="flex items-center justify-end gap-3">
          {saved && <span className="text-sm text-accent">Réglages enregistrés.</span>}
          <Button type="submit" disabled={save.isPending}>
            Enregistrer
          </Button>
        </div>
      </form>
    </Card>
  );
}

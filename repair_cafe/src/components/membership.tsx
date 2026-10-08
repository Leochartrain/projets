import { useState, type FormEvent } from 'react';
import {
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  RATES,
  RATE_LABELS,
  rateAmount,
  suggestedRate,
  type MembershipInput,
  type MembershipSettings,
  type PaymentMethod,
  type Rate,
  type Visitor,
} from '@shared/domain';
import { api, errorText, useSave, useSettings } from '@/api';
import { euros, parseDecimal } from '@/format';
import { Button, ErrorBox, Modal, SelectField, TextField } from './ui';

export const currentYear = () => new Date().getFullYear();

/**
 * Saisie de l'adhésion. Le tarif suit la commune tant qu'on ne le change pas à la main,
 * et le montant suit le tarif tant qu'on ne le change pas non plus.
 */
export interface MembershipDraft {
  paid: boolean;
  rate: Rate | null;
  amount: string | null;
  paymentMethod: PaymentMethod | '';
}

export const emptyMembership: MembershipDraft = { paid: true, rate: null, amount: null, paymentMethod: 'cash' };

function resolve(draft: MembershipDraft, city: string | null, settings: MembershipSettings | undefined) {
  const rate = draft.rate ?? (settings ? suggestedRate(city, settings) : null);
  const amountCents = draft.amount !== null ? Math.round((parseDecimal(draft.amount) ?? 0) * 100) : rate && settings ? rateAmount(rate, settings) : null;
  return { rate, amountCents };
}

/** Ce qu'on envoie à l'API : null si l'adhésion n'est pas réglée maintenant. */
export function membershipPayload(draft: MembershipDraft, city: string | null, settings: MembershipSettings | undefined): MembershipInput | null {
  if (!draft.paid) return null;
  const { rate, amountCents } = resolve(draft, city, settings);
  if (!rate || amountCents === null) return null;
  return { rate, amountCents, paymentMethod: draft.paymentMethod || null };
}

export function MembershipFields({ city, value, onChange, optional = true }: { city: string; value: MembershipDraft; onChange: (value: MembershipDraft) => void; optional?: boolean }) {
  const { data: settings } = useSettings();
  const { rate, amountCents } = resolve(value, city, settings);
  const set = (patch: Partial<MembershipDraft>) => onChange({ ...value, ...patch });
  const reduced = settings && suggestedRate(city, settings) === 'reduced';

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-paper/60 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-medium">Adhésion {currentYear()}</span>
        {settings && (
          <span className="text-sm text-muted">
            {!city.trim()
              ? 'Indique la commune pour connaître le tarif.'
              : reduced
                ? `${city} : tarif réduit (${euros(settings.reducedCents)})`
                : `${city} n'est pas dans la liste du tarif réduit : ${euros(settings.standardCents)}`}
          </span>
        )}
      </div>
      {optional && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" className="size-4 accent-accent" checked={value.paid} onChange={(e) => set({ paid: e.target.checked })} />
          Réglée maintenant
        </label>
      )}
      {value.paid && (
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectField label="Tarif" required value={rate ?? ''} onChange={(e) => set({ rate: e.target.value as Rate, amount: null })}>
            <option value="" disabled>
              Choisir…
            </option>
            {RATES.map((r) => (
              <option key={r} value={r}>
                {RATE_LABELS[r]}
                {settings && r !== 'free' ? ` (${euros(rateAmount(r, settings))})` : ''}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Montant (€)"
            inputMode="decimal"
            required
            value={value.amount ?? (amountCents === null ? '' : (amountCents / 100).toString().replace('.', ','))}
            onChange={(e) => set({ amount: e.target.value })}
          />
          <SelectField label="Paiement" value={value.paymentMethod} onChange={(e) => set({ paymentMethod: e.target.value as PaymentMethod | '' })}>
            {PAYMENT_METHODS.map((m) => (
              <option key={m} value={m}>
                {PAYMENT_LABELS[m]}
              </option>
            ))}
          </SelectField>
        </div>
      )}
      {optional && !value.paid && <p className="text-sm text-amber">L'adhésion sera à régler avant la réparation.</p>}
    </div>
  );
}

export function MembershipBadge({ visitor }: { visitor: Pick<Visitor, 'membership' | 'anonymized'> }) {
  if (visitor.anonymized) return null;
  return visitor.membership ? (
    <span className="inline-flex whitespace-nowrap rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-strong">Adhérent {visitor.membership.year}</span>
  ) : (
    <span className="inline-flex whitespace-nowrap rounded-full bg-amber-soft px-2.5 py-0.5 text-xs font-semibold text-amber">Adhésion à régler</span>
  );
}

/** Encaisser l'adhésion d'un visiteur déjà enregistré. */
export function PayMembershipModal({ visitorId, visitorName, city, onClose, onPaid }: { visitorId: number; visitorName: string; city: string | null; onClose: () => void; onPaid?: () => void }) {
  const { data: settings } = useSettings();
  const [draft, setDraft] = useState<MembershipDraft>(emptyMembership);
  const [town, setTown] = useState(city ?? '');
  const save = useSave(async () => {
    const payload = membershipPayload(draft, town, settings);
    if (!payload) throw new Error('Choisis le tarif.');
    if (town.trim() !== (city ?? '')) await api.patch(`/visitors/${visitorId}`, { city: town });
    return api.post(`/visitors/${visitorId}/memberships`, payload);
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    await save.mutateAsync(undefined);
    onClose();
    onPaid?.();
  }

  return (
    <Modal open onClose={onClose} title={`Adhésion de ${visitorName}`} wide>
      <form onSubmit={submit} className="flex flex-col gap-4">
        {!city && <TextField label="Commune" required hint="Elle fixe le tarif." value={town} onChange={(e) => setTown(e.target.value)} />}
        <MembershipFields city={town} value={draft} onChange={setDraft} optional={false} />
        {save.error && <ErrorBox>{errorText(save.error)}</ErrorBox>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={save.isPending}>
            Enregistrer l'adhésion
          </Button>
        </div>
      </form>
    </Modal>
  );
}

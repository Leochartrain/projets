import { CATEGORIES, type CategoryId } from '@shared/domain';
import { parseDecimal } from '@/format';
import { SelectField, TextArea, TextField } from './ui';

// L'objet apporté : partagé par l'accueil, la fiche réparation et la réservation en ligne.

export interface ObjectDraft {
  category: CategoryId | '';
  object: string;
  brand: string;
  model: string;
  ageYears: string;
  problem: string;
  weightKg: string;
}

export const emptyObject: ObjectDraft = { category: '', object: '', brand: '', model: '', ageYears: '', problem: '', weightKg: '' };

export function objectPayload(draft: ObjectDraft) {
  const age = parseDecimal(draft.ageYears);
  return {
    category: draft.category,
    object: draft.object,
    brand: draft.brand,
    model: draft.model,
    ageYears: age === null ? null : Math.round(age),
    problem: draft.problem,
    weightKg: parseDecimal(draft.weightKg),
  };
}

export function ObjectFields({ value, onChange, withWeight = true }: { value: ObjectDraft; onChange: (value: ObjectDraft) => void; withWeight?: boolean }) {
  const set = (patch: Partial<ObjectDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Catégorie" required value={value.category} onChange={(e) => set({ category: e.target.value as CategoryId })}>
        <option value="" disabled>
          Choisir…
        </option>
        {CATEGORIES.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </SelectField>
      <TextField label="Objet" required maxLength={120} placeholder="Grille-pain, jean, vélo…" value={value.object} onChange={(e) => set({ object: e.target.value })} />
      <TextField label="Marque" maxLength={80} value={value.brand} onChange={(e) => set({ brand: e.target.value })} />
      <TextField label="Modèle" maxLength={80} value={value.model} onChange={(e) => set({ model: e.target.value })} />
      <div className="sm:col-span-2">
        <TextArea label="Panne constatée" required maxLength={2000} placeholder="Ce qui ne marche plus, depuis quand, ce qui a déjà été essayé…" value={value.problem} onChange={(e) => set({ problem: e.target.value })} />
      </div>
      <TextField label="Âge approximatif (ans)" inputMode="numeric" value={value.ageYears} onChange={(e) => set({ ageYears: e.target.value })} />
      {withWeight && <TextField label="Poids (kg)" inputMode="decimal" hint="Pour le calcul des déchets évités." value={value.weightKg} onChange={(e) => set({ weightKg: e.target.value })} />}
    </div>
  );
}

export interface VisitorDraft {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  postalCode: string;
}

export const emptyVisitor: VisitorDraft = { firstName: '', lastName: '', phone: '', email: '', postalCode: '' };

export function VisitorFields({ value, onChange }: { value: VisitorDraft; onChange: (value: VisitorDraft) => void }) {
  const set = (patch: Partial<VisitorDraft>) => onChange({ ...value, ...patch });
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField label="Prénom" required autoComplete="given-name" maxLength={60} value={value.firstName} onChange={(e) => set({ firstName: e.target.value })} />
      <TextField label="Nom" required autoComplete="family-name" maxLength={60} value={value.lastName} onChange={(e) => set({ lastName: e.target.value })} />
      <TextField label="Téléphone" type="tel" autoComplete="tel" maxLength={30} value={value.phone} onChange={(e) => set({ phone: e.target.value })} />
      <TextField label="E-mail" type="email" autoComplete="email" maxLength={200} value={value.email} onChange={(e) => set({ email: e.target.value })} />
      <TextField label="Code postal" autoComplete="postal-code" inputMode="numeric" maxLength={10} hint="Pour savoir d'où viennent les visiteurs." value={value.postalCode} onChange={(e) => set({ postalCode: e.target.value })} />
    </div>
  );
}

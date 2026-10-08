import { ButtonLink, EmptyState } from '@/components/ui';

export function NotFoundPage() {
  return (
    <EmptyState title="Page introuvable">
      <div className="flex flex-col items-center gap-4">
        <p>Cette adresse ne mène nulle part.</p>
        <ButtonLink to="/">Retour au tableau de bord</ButtonLink>
      </div>
    </EmptyState>
  );
}

import { ButtonLink } from '@/components/ui';

export function NotFoundPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5">
      <span className="label">Page introuvable</span>
      <h1 className="text-3xl">Cette page n'existe pas</h1>
      <ButtonLink to="/" variant="secondary">
        Retour à l'accueil
      </ButtonLink>
    </main>
  );
}

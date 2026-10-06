/** Affiché tant que .env.local ne contient pas l'adresse et la clé du projet Supabase. */
export function SetupPage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-5 py-10">
      <span className="label">Configuration</span>
      <h1 className="text-3xl">Connecte la base de données</h1>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        <li>Crée un projet gratuit sur supabase.com (région Europe).</li>
        <li>
          Copie <code className="font-mono text-sm">.env.example</code> en <code className="font-mono text-sm">.env.local</code>.
        </li>
        <li>Remplis l'adresse du projet et sa clé publique (Project Settings → API).</li>
        <li>Relance « npm run dev ».</li>
      </ol>
    </main>
  );
}

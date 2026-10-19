export default function Home() {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 py-16 font-sans">
      <main className="w-full max-w-xl space-y-6 text-center">
        <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
          Praca inżynierska — szkielet
        </p>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900">
          Rezerwacja wizyt i dokumentacja dermatologiczna
        </h1>
        <p className="text-base leading-7 text-zinc-600">
          Frontend (Next.js) działa. Backend REST API jest dostępny pod adresem
          poniżej (Swagger: <code className="text-sm">/docs</code>).
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <a
            className="rounded-md bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-700"
            href={`${apiUrl}/docs`}
            target="_blank"
            rel="noreferrer"
          >
            Otwórz Swagger API
          </a>
          <a
            className="rounded-md border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-900 hover:bg-zinc-100"
            href={`${apiUrl}/health`}
            target="_blank"
            rel="noreferrer"
          >
            Sprawdź /health
          </a>
        </div>
      </main>
    </div>
  );
}

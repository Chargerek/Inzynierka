import Link from "next/link";

const FEATURES = [
  {
    title: "Rezerwacja online",
    description:
      "Wybierz usługę, lekarza i dogodny termin — bez telefonowania do rejestracji.",
  },
  {
    title: "Historia wizyt",
    description:
      "Wszystkie zaplanowane i odbyte wizyty w jednym miejscu, z możliwością odwołania.",
  },
  {
    title: "Dokumentacja dermatologiczna",
    description:
      "Lekarz dokumentuje zmiany skórne na mapie ciała i porównuje je między wizytami.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-gray-100">
      <section className="bg-white">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-zinc-500">
            Gabinet Dermatologiczny
          </p>
          <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-zinc-900">
            Umów wizytę u dermatologa w kilka minut
          </h1>
          <p className="max-w-xl text-base leading-7 text-zinc-600">
            Rezerwuj konsultacje i zabiegi online, śledź historie wizyt i miej
            dokumentację skóry zawsze pod ręką.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/panel/umow"
              className="rounded-md bg-violet-700 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-600"
            >
              Umów wizytę
            </Link>
            <Link
              href="/cennik"
              className="rounded-md border border-zinc-300 bg-white px-6 py-3 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100"
            >
              Zobacz cennik
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 py-16 bg-gray-100">
        <div className="grid gap-6 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="rounded-lg border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md"
            >
              <h2 className="text-lg font-semibold text-zinc-900">
                {feature.title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-zinc-600">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

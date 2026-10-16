import Link from "next/link";
import { house } from "@/lib/house";
import { prettyDate } from "@/lib/format";
import { SiteFooter } from "@/components/Chrome";

export default function BookedPage({
  searchParams,
}: {
  searchParams: { ref?: string; room?: string; in?: string; out?: string; count?: string };
}) {
  const { ref, room, in: checkIn, out: checkOut, count } = searchParams;
  const n = count ? parseInt(count, 10) : 0;

  return (
    <main className="flex min-h-screen flex-col bg-sand/40">
      <div className="flex flex-1 items-center justify-center px-6 py-24">
        <div className="rise w-full max-w-lg rounded-3xl bg-cream p-10 text-center shadow-soft">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-lake/15 text-3xl">
            🌿
          </div>
          <h1 className="mt-6 font-display text-4xl text-forest">
            {n > 1 ? `${n} requests sent` : "Request sent"}
          </h1>
          <p className="mt-3 leading-relaxed text-pine/90">
            {n > 1
              ? `Thank you — we've got your ${n} stay requests and we'll email you shortly to confirm.`
              : "Thank you — we've got your request and we'll email you shortly to confirm."}
          </p>

          {ref && (
            <div className="mt-8 rounded-2xl border border-clay/30 bg-white/60 p-6 text-left">
              <div className="flex justify-between text-sm">
                <span className="text-pine/70">Reference</span>
                <span className="font-mono text-forest">{ref}</span>
              </div>
              {room && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-pine/70">Room</span>
                  <span className="text-forest">{room}</span>
                </div>
              )}
              {checkIn && checkOut && (
                <div className="mt-2 flex justify-between text-sm">
                  <span className="text-pine/70">Dates</span>
                  <span className="text-forest">
                    {prettyDate(checkIn)} → {prettyDate(checkOut)}
                  </span>
                </div>
              )}
            </div>
          )}

          <Link
            href="/"
            className="mt-8 inline-block rounded-xl bg-forest px-6 py-3 font-medium text-cream transition hover:bg-pine"
          >
            Back to {house.name}
          </Link>
        </div>
      </div>
      <SiteFooter />
    </main>
  );
}

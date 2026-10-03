import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { RotateCcw, Timer, MousePointerClick } from "lucide-react";
import { useSeo } from "@/lib/site";
import { LogoMark, SectionLabel } from "@/components/site/primitives";
import { CtaLink, WhatsAppCta } from "@/components/site/cta";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Material Match — a short memory game built from the studio's        */
/* material library. Pure CSS textures, no image downloads.            */
/* ------------------------------------------------------------------ */

type Material = { id: string; name: string; note: string; style: CSSProperties; dark?: boolean };

const MATERIALS: Material[] = [
  {
    id: "walnut", name: "Walnut", note: "Warm, deep grain for joinery & wall panels", dark: true,
    style: { background: "repeating-linear-gradient(100deg, #5a3a24 0 6px, #6b452b 6px 9px, #4e321f 9px 15px, #74502f 15px 17px)" },
  },
  {
    id: "brass", name: "Brushed Brass", note: "Handles, profiles & lighting accents",
    style: { background: "linear-gradient(135deg, #8c6a35 0%, #d8b878 38%, #b5935a 55%, #f1dca8 70%, #9c7a42 100%)" },
  },
  {
    id: "travertine", name: "Travertine", note: "Soft, porous stone for counters & floors",
    style: { background: "repeating-linear-gradient(0deg, #e9dcc6 0 7px, #ddcdb2 7px 9px, #efe4d1 9px 18px, #d6c4a6 18px 19px)" },
  },
  {
    id: "marble", name: "Nero Marble", note: "Dramatic black stone for statement walls", dark: true,
    style: {
      background:
        "linear-gradient(120deg, transparent 46%, rgba(255,255,255,.55) 47%, transparent 49%), linear-gradient(35deg, transparent 60%, rgba(255,255,255,.35) 61%, transparent 62.5%), linear-gradient(160deg, #1b1a19, #2c2a28 60%, #121110)",
    },
  },
  {
    id: "cane", name: "Cane Weave", note: "Light, breathable shutters & headboards",
    style: {
      backgroundColor: "#d9bf8c",
      backgroundImage:
        "radial-gradient(circle at 50% 50%, #7a5a2e 2px, transparent 2.5px), repeating-linear-gradient(45deg, transparent 0 6px, rgba(122,90,46,.45) 6px 8px), repeating-linear-gradient(-45deg, transparent 0 6px, rgba(122,90,46,.45) 6px 8px)",
      backgroundSize: "14px 14px, auto, auto",
    },
  },
  {
    id: "boucle", name: "Bouclé", note: "Textured ivory upholstery",
    style: {
      backgroundColor: "#f1ebdf",
      backgroundImage: "radial-gradient(#d8cfbf 1.6px, transparent 1.8px), radial-gradient(#e4dccd 1.4px, transparent 1.6px)",
      backgroundSize: "8px 8px, 8px 8px",
      backgroundPosition: "0 0, 4px 4px",
    },
  },
  {
    id: "terrazzo", name: "Terrazzo", note: "Playful chips for foyers & bathrooms",
    style: {
      backgroundColor: "#ece6dc",
      backgroundImage:
        "radial-gradient(circle at 20% 30%, #b5935a 0 3px, transparent 3.5px), radial-gradient(circle at 70% 20%, #5a3a24 0 2.5px, transparent 3px), radial-gradient(circle at 40% 75%, #8d8a84 0 4px, transparent 4.5px), radial-gradient(circle at 85% 70%, #b5935a 0 2px, transparent 2.5px), radial-gradient(circle at 10% 85%, #2c2a28 0 2px, transparent 2.5px)",
      backgroundSize: "46px 46px",
    },
  },
  {
    id: "smoked-oak", name: "Smoked Oak", note: "Muted grey-brown for kitchens", dark: true,
    style: { background: "repeating-linear-gradient(92deg, #4a4038 0 5px, #574c42 5px 8px, #3f3630 8px 13px, #5e5247 13px 14px)" },
  },
];

type Card = { key: number; mat: Material };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function newDeck(): Card[] {
  return shuffle(MATERIALS.flatMap((m, i) => [{ key: i * 2, mat: m }, { key: i * 2 + 1, mat: m }]));
}

function formatTime(s: number) {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function Play() {
  useSeo({ title: "Material Match — a short game", description: "Match the materials we use in Oak & Line homes. A two-minute memory game." });

  const [deck, setDeck] = useState<Card[]>(newDeck);
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [moves, setMoves] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [started, setStarted] = useState(false);
  const [best, setBest] = useState<number | null>(null);
  const [lastFound, setLastFound] = useState<Material | null>(null);
  const lock = useRef(false);

  const done = matched.size === MATERIALS.length;

  useEffect(() => {
    if (!started || done) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, done]);

  useEffect(() => {
    if (done) setBest((b) => (b === null ? moves : Math.min(b, moves)));
  }, [done, moves]);

  const flip = useCallback(
    (idx: number) => {
      if (lock.current || open.includes(idx) || matched.has(deck[idx].mat.id)) return;
      if (!started) setStarted(true);
      const next = [...open, idx];
      setOpen(next);
      if (next.length === 2) {
        setMoves((m) => m + 1);
        const [a, b] = next;
        if (deck[a].mat.id === deck[b].mat.id) {
          setMatched((s) => new Set(s).add(deck[a].mat.id));
          setLastFound(deck[a].mat);
          setOpen([]);
        } else {
          lock.current = true;
          setTimeout(() => {
            setOpen([]);
            lock.current = false;
          }, 850);
        }
      }
    },
    [open, matched, deck, started],
  );

  const reset = () => {
    setDeck(newDeck());
    setOpen([]);
    setMatched(new Set());
    setMoves(0);
    setSeconds(0);
    setStarted(false);
    setLastFound(null);
    lock.current = false;
  };

  const rating = useMemo(() => (moves <= 12 ? "Master craftsman" : moves <= 16 ? "Senior designer" : moves <= 22 ? "Design apprentice" : "Keen eye in training"), [moves]);

  return (
    <section className="pt-32 md:pt-44 pb-24 md:pb-32">
      <div className="container-x grid gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <SectionLabel>Material Match</SectionLabel>
          <h1 className="font-display mt-6 text-5xl md:text-6xl leading-[1.02]">Find the pairs.</h1>
          <p className="mt-6 text-muted-foreground leading-relaxed">
            Eight materials from our studio library are hidden on the board. Turn two tiles at a time and match every pair in as few moves as you can.
          </p>

          <dl className="mt-10 grid grid-cols-3 gap-4 border-y border-border py-6" aria-live="polite">
            <div>
              <dt className="eyebrow text-muted-foreground flex items-center gap-1.5"><MousePointerClick className="h-3.5 w-3.5" aria-hidden="true" />Moves</dt>
              <dd className="font-display text-3xl mt-1 tabular-nums" data-testid="text-moves">{moves}</dd>
            </div>
            <div>
              <dt className="eyebrow text-muted-foreground flex items-center gap-1.5"><Timer className="h-3.5 w-3.5" aria-hidden="true" />Time</dt>
              <dd className="font-display text-3xl mt-1 tabular-nums" data-testid="text-time">{formatTime(seconds)}</dd>
            </div>
            <div>
              <dt className="eyebrow text-muted-foreground">Pairs</dt>
              <dd className="font-display text-3xl mt-1 tabular-nums" data-testid="text-pairs">{matched.size}/{MATERIALS.length}</dd>
            </div>
          </dl>

          <div className="mt-6 min-h-[4.5rem]" aria-live="polite">
            {lastFound && !done && (
              <p className="text-sm page-in" key={lastFound.id}>
                <span className="text-gold-deep font-medium">{lastFound.name}</span> — {lastFound.note}.
              </p>
            )}
          </div>

          <button type="button" onClick={reset} className="inline-flex items-center gap-2 eyebrow text-muted-foreground hover:text-foreground" data-testid="button-reset-game">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> New board
          </button>
          {best !== null && <p className="mt-3 text-xs text-muted-foreground" data-testid="text-best">Best this visit: {best} moves</p>}
        </div>

        <div className="lg:col-span-7 lg:col-start-6">
          {done ? (
            <div className="bg-ink text-ivory p-8 md:p-12 page-in" data-testid="status-game-complete">
              <p className="eyebrow text-gold">Board complete</p>
              <h2 className="font-display mt-4 text-4xl md:text-5xl leading-tight">{rating}.</h2>
              <p className="mt-4 text-[hsl(var(--ivory)/0.75)]">
                {moves} moves in {formatTime(seconds)}. Every one of these materials can be specified for your home — we bring physical samples to each consultation.
              </p>
              <ul className="mt-8 grid grid-cols-4 gap-2" aria-label="Materials you matched">
                {MATERIALS.map((m) => (
                  <li key={m.id} className="aspect-square" style={m.style} title={m.name}><span className="sr-only">{m.name}</span></li>
                ))}
              </ul>
              <div className="mt-10 flex flex-col sm:flex-row gap-3">
                <CtaLink href="/contact" variant="gold" testId="button-game-discuss">Discuss Your Project</CtaLink>
                <button type="button" onClick={reset} className="inline-flex items-center justify-center gap-2 min-h-[48px] px-7 border border-[hsl(var(--ivory)/0.5)] text-[0.8rem] uppercase tracking-[0.16em] hover:bg-[hsl(var(--ivory))] hover:text-[hsl(var(--ink))] transition-colors" data-testid="button-play-again">
                  Play again
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2 sm:gap-3 [perspective:1200px]" role="grid" aria-label="Material Match board">
              {deck.map((c, idx) => {
                const faceUp = open.includes(idx) || matched.has(c.mat.id);
                const isMatched = matched.has(c.mat.id);
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => flip(idx)}
                    disabled={isMatched}
                    aria-label={faceUp ? `${c.mat.name}${isMatched ? ", matched" : ""}` : `Hidden tile ${idx + 1}`}
                    aria-pressed={faceUp}
                    className="relative aspect-square [transform-style:preserve-3d] transition-transform duration-700 ease-[cubic-bezier(.16,1,.3,1)] focus-visible:outline-offset-2"
                    style={{ transform: faceUp ? "rotateY(180deg)" : "none" }}
                    data-testid={`button-tile-${idx}`}
                  >
                    <span className="absolute inset-0 grid place-items-center bg-ink text-[hsl(var(--ivory)/0.85)] [backface-visibility:hidden] ring-1 ring-inset ring-[hsl(var(--gold)/0.25)] hover:ring-[hsl(var(--gold)/0.7)] transition-shadow">
                      <LogoMark className="h-8 w-8 sm:h-10 sm:w-10 opacity-80" />
                    </span>
                    <span
                      className={cn(
                        "absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] flex items-end p-2 sm:p-3",
                        isMatched && "ring-2 ring-inset ring-[hsl(var(--gold))]",
                      )}
                      style={c.mat.style}
                    >
                      <span className={cn("text-[0.62rem] sm:text-xs font-medium uppercase tracking-[0.12em] px-1.5 py-0.5", c.mat.dark ? "bg-black/40 text-white" : "bg-white/70 text-[hsl(var(--ink))]")}>
                        {c.mat.name}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          {!done && (
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:items-center justify-between">
              <p className="text-sm text-muted-foreground">Prefer to see them in person? We bring samples to every consultation.</p>
              <WhatsAppCta label="Ask for samples" variant="outline" testId="link-game-whatsapp" />
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

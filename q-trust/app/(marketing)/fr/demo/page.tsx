import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"
import { DemoForm } from "./demo-form"

export const metadata: Metadata = {
  title: "Réservez une démo",
  description:
    "Réservez une démo en direct de Q-Trust — nous vous montrons la présence par QR, les paiements et les rapports avec des données fictives, chez vous ou à distance.",
}

const STEPS = [
  { n: "1", text: "Remplissez le formulaire — nous recevons votre demande instantanément." },
  { n: "2", text: "Nous vous appelons sous un jour ouvré pour comprendre vos besoins et fixer un rendez-vous." },
  { n: "3", text: "Démo en direct de 30 minutes avec des données fictives — chez vous ou à distance." },
]

export default function FrenchDemoPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <div className="grid gap-12 lg:grid-cols-[1fr_1.2fr] lg:gap-16">
          <Reveal>
            <p className="mk-eyebrow mb-3">Démo</p>
            <h1 className="mk-display mk-h2 max-w-[18ch]">Voyez votre plateforme fonctionner avant de vous engager</h1>
            <p className="mk-lead mt-5 max-w-[48ch]">
              Démonstration en direct sur des données fictives : la présence par QR, le tableau de
              bord et le registre des paiements — posez toutes vos questions.
            </p>
            <ol className="mt-9 space-y-4">
              {STEPS.map((s) => (
                <li key={s.n} className="flex items-start gap-3.5">
                  <span className="mk-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                    {s.n}
                  </span>
                  <p className="mk-body pt-1 text-sm">{s.text}</p>
                </li>
              ))}
            </ol>
          </Reveal>
          <Reveal delay={100}>
            <DemoForm />
          </Reveal>
        </div>
      </div>
    </section>
  )
}

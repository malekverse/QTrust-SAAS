import type { Metadata } from "next"
import Link from "next/link"
import { CalendarCheck, MessageCircle } from "lucide-react"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Contactez-nous",
  description: "Contactez l'équipe Q-Trust — réservez une démo ou envoyez votre question, nous vous recontacterons sous un jour ouvré.",
}

export default function FrenchContactPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Contactez-nous</p>
          <h1 className="mk-display mk-h2">Nous répondons sous un jour ouvré</h1>
          <p className="mk-lead mt-5">
            Que vous découvriez la plateforme pour la première fois ou que vous ayez une question
            précise — le plus rapide est le formulaire de demande de démo, qui nous parvient directement.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-6 sm:grid-cols-2 max-w-3xl">
          <Reveal>
            <Link href="/fr/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarCheck className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">Réservez une démo</h2>
              <p className="mk-body mt-2 text-sm">
                Démo en direct de 30 minutes avec des données fictives, dans vos locaux ou à distance.
                La meilleure façon de commencer.
              </p>
            </Link>
          </Reveal>
          <Reveal delay={80}>
            <Link href="/fr/demo" className="mk-card mk-card--lift block h-full p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <MessageCircle className="h-5.5 w-5.5" />
              </span>
              <h2 className="mk-display mt-5 text-xl font-bold">Question ou renseignement</h2>
              <p className="mk-body mt-2 text-sm">
                Écrivez votre question dans le champ remarques du même formulaire et nous vous
                appellerons pour y répondre — tarifs, migration de données ou autre.
              </p>
            </Link>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

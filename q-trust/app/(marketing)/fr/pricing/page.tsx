import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { PricingCards } from "@/components/marketing/pricing-cards"

export const metadata: Metadata = {
  title: "Tarifs",
  description:
    "Forfaits Q-Trust pour les associations et écoles coraniques : Essentiel, Professionnel et Avancé — tarifs annuels en dinars tunisiens avec frais d'installation uniques.",
}

const NOTES = [
  {
    q: "Comment se fait le paiement ?",
    a: "Par virement bancaire, chèque ou espèces lors de l'installation — nous établissons une facture pour chaque opération. Aucune carte bancaire n'est nécessaire.",
  },
  {
    q: "Les prix sont-ils négociables ?",
    a: "Les montants affichés sont des tarifs indicatifs. L'offre finale est ajustée selon la taille de l'association et ses besoins lors de la prise de contact avec l'équipe commerciale.",
  },
  {
    q: "Que sont les cartes QR élèves ?",
    a: "Des cartes PVC imprimées au nom de votre association avec un identifiant QR unique pour chaque élève, remises lors de l'installation — service complémentaire à 2,5–3,5 DT par carte, disponible avec tous les forfaits.",
  },
  {
    q: "Y a-t-il une période d'essai ?",
    a: "Oui — la formule Essentiel fonctionne comme un essai gratuit de 14 jours, et nous pouvons également faire une démonstration en direct avec des données fictives avant tout engagement.",
  },
]

export default function FrenchPricingPage() {
  return (
    <>
      <section className="pt-36 pb-4">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">Tarifs</p>
            <h1 className="mk-display mk-h2">Des prix clairs, payés une fois par an</h1>
            <p className="mk-lead mt-5">
              Des frais d'installation uniques couvrant la mise en place, la formation et la migration
              de vos données, puis un abonnement annuel selon la formule choisie.
              Pas de surprises, pas de frais cachés.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mk-section pt-12">
        <div className="mk-container">
          <PricingCards locale="fr" />
        </div>
      </section>

      <section className="mk-section pt-0">
        <div className="mk-container">
          <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
            <Reveal>
              <h2 className="mk-display mk-h3">Questions que nous entendons à chaque visite</h2>
            </Reveal>
            <div className="space-y-8">
              {NOTES.map((n, i) => (
                <Reveal key={n.q} delay={i * 60}>
                  <div className="mk-hairline-gold pt-5">
                    <h3 className="font-semibold">{n.q}</h3>
                    <p className="mk-body mt-2 text-sm">{n.a}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal className="mt-20 text-center">
            <div className="mk-card mx-auto max-w-2xl p-10">
              <h2 className="mk-display mk-h3">Pas sûr de la formule qui vous convient ?</h2>
              <p className="mk-body mt-3">
                Réservez une démo et nous vous aidons à choisir en fonction du nombre d'élèves et du
                fonctionnement de votre association.
              </p>
              <Link href="/fr/demo" className="mk-btn mk-btn-primary mt-7">
                Contactez les ventes
                <span className="mk-btn-arrow" aria-hidden="true">→</span>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  )
}

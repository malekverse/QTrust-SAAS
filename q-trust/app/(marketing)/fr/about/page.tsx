import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "À propos",
  description:
    "Q-Trust est une plateforme tunisienne spécialisée dans la gestion des associations et écoles coraniques — construite autour des besoins des directeurs, enseignants et familles.",
}

const VALUES = [
  {
    title: "Spécialistes d'un seul domaine",
    body: "Nous ne construisons pas un logiciel scolaire générique qu'on arabise ensuite — Q-Trust est conçu dès la première ligne autour du fonctionnement des associations et écoles coraniques : les séances et halaqat, la présence quotidienne, les cotisations mensuelles et la relation de l'association avec les parents. Cette spécialisation est la raison de la simplicité d'utilisation de la plateforme.",
  },
  {
    title: "L'arabe d'abord, pas une traduction après coup",
    body: "La plateforme est conçue de droite à gauche et écrite en arabe dès le départ — interfaces, rapports, et même l'assistant intelligent parle arabe. Parce que les outils de l'association doivent parler sa langue.",
  },
  {
    title: "Les données des élèves sont un dépôt sacré",
    body: "Nous traitons des données de mineurs : noms, photos, numéros de téléphone des parents. C'est pourquoi chaque association est totalement isolée des autres, chaque opération sensible est consignée dans un journal d'activités, et nous ne vendons ni ne partageons les données — consultez notre politique de confidentialité.",
  },
  {
    title: "Une relation directe, pas des tickets de support",
    body: "L'équipe Q-Trust installe la plateforme avec vous dans vos locaux, forme votre équipe et reste joignable par téléphone. Notre croissance vient de la satisfaction des associations et de leurs recommandations mutuelles — pas de contrats signés et oubliés. Nous sommes basés à Ariana et nous nous déplaçons dans tout le pays.",
  },
]

export default function FrenchAboutPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">À propos</p>
            <h1 className="mk-display mk-h2">Une plateforme tunisienne spécialisée dans la gestion des associations coraniques</h1>
            <p className="mk-lead mt-5">
              Q-Trust centralise la présence, les paiements et le suivi dans un système unique qui
              respecte le fonctionnement de ces institutions — développé en Tunisie, et en arabe dès
              le départ.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="mk-section pt-12">
        <div className="mk-container">
          <div className="grid gap-x-14 gap-y-12 md:grid-cols-2">
            {VALUES.map((v, i) => (
              <Reveal key={v.title} delay={(i % 2) * 80}>
                <div className="mk-hairline-gold pt-6">
                  <h2 className="mk-display text-xl font-bold">{v.title}</h2>
                  <p className="mk-body mt-3 text-sm sm:text-base">{v.body}</p>
                </div>
              </Reveal>
            ))}
          </div>

          <Reveal className="mt-24 text-center">
            <h2 className="mk-display mk-h3">Envie de voir ce que nous avons construit ?</h2>
            <Link href="/fr/demo" className="mk-btn mk-btn-primary mt-7">
              Réserver une démo
              <span className="mk-btn-arrow" aria-hidden="true">→</span>
            </Link>
          </Reveal>
        </div>
      </section>
    </>
  )
}

import type { Metadata } from "next"
import Link from "next/link"
import { Reveal } from "@/components/marketing/reveal"
import { BrowserFrame, ScreenshotSlot } from "@/components/marketing/frames"
import { ScanDemo } from "@/components/marketing/scan-demo"
import { ProductVideo } from "@/components/marketing/product-video"
import { SHOTS, AI_VIDEO, QR_VIDEO } from "@/components/marketing/content"

export const metadata: Metadata = {
  title: "Fonctionnalités",
  description:
    "Toutes les capacités de Q-Trust en détail : présence par QR, tableau de bord et rapports, registre des paiements, portail élèves et parents, assistant intelligent en arabe.",
}

const SECTIONS = [
  {
    key: "qr",
    eyebrow: "Présence",
    title: "Un scan QR enregistre la présence en une seconde",
    body: "Chaque élève possède une carte avec un identifiant QR unique. À l'entrée de la salle, il la passe devant la caméra — tablette à la porte ou navigateur du superviseur — et sa présence est enregistrée instantanément dans la bonne séance, avec une fenêtre horaire configurable par l'association. Les retardataires sont notés en retard, les absents apparaissent automatiquement — sans aucune saisie manuelle.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    eyebrow: "Tableau de bord",
    title: "Les chiffres du jour sous vos yeux, en temps réel",
    body: "Séances du jour, taux de présence, absences, réclamations en attente et état des cotisations — sur un seul écran qui parle en direct. Rapports hebdomadaires et mensuels prêts à présenter au conseil d'administration, sans compilation manuelle.",
    shot: "dashboard" as const,
  },
  {
    key: "payments",
    eyebrow: "Paiements",
    title: "Un registre de cotisations où personne ne passe à travers",
    body: "La cotisation de chaque élève pour chaque mois : payée ou en retard, en un clic ou par opération groupée. Export CSV prêt pour la comptabilité, et un historique qui montre qui a enregistré chaque opération et quand — transparence totale devant les familles et le conseil.",
    shot: "ledger" as const,
  },
  {
    key: "portal",
    eyebrow: "Portail élève et parent",
    title: "Chaque famille suit le parcours de son enfant",
    body: "Un compte par élève affichant sa présence, ses séances, ses documents pédagogiques et ses résultats. Le parent consulte depuis son téléphone sans avoir à demander à personne — et l'association gagne la confiance des familles par une transparence quotidienne.",
    shot: "dashboard" as const,
  },
]

export default function FrenchFeaturesPage() {
  return (
    <>
      <section className="pt-36 pb-6">
        <div className="mk-container">
          <Reveal className="max-w-[50ch]">
            <p className="mk-eyebrow mb-3">Fonctionnalités</p>
            <h1 className="mk-display mk-h2">Une plateforme unique pour gérer la journée entière</h1>
            <p className="mk-lead mt-5">
              De l'arrivée de l'élève au rapport de fin de mois — chaque fonctionnalité est construite
              autour du fonctionnement réel des associations coraniques, en arabe et de droite à gauche.
            </p>
          </Reveal>
        </div>
      </section>

      {SECTIONS.map((s, i) => (
        <section key={s.key} className="mk-section pt-10">
          <div className="mk-container">
            <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
              <Reveal className={i % 2 === 1 ? "lg:order-2" : ""}>
                <p className="mk-eyebrow mb-3">{s.eyebrow}</p>
                <h2 className="mk-display mk-h3 max-w-[24ch]">{s.title}</h2>
                <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">{s.body}</p>
              </Reveal>
              <Reveal delay={80} className={i % 2 === 1 ? "lg:order-1" : ""}>
                <BrowserFrame>
                  {s.key === "qr" ? (
                    <ProductVideo
                      src={QR_VIDEO.src}
                      poster={QR_VIDEO.poster}
                      label="Enregistrement réel de la plateforme : écran de pointage par QR"
                    />
                  ) : (
                    <ScreenshotSlot
                      src={SHOTS[s.shot] || undefined}
                      alt={s.title}
                      label="Capture d'écran réelle de la plateforme"
                    />
                  )}
                </BrowserFrame>
              </Reveal>
            </div>
          </div>
        </section>
      ))}

      {/* Scanner app */}
      <section className="mk-section pt-10">
        <div className="mk-container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <p className="mk-eyebrow mb-3">Application scanner</p>
              <h2 className="mk-display mk-h3 max-w-[24ch]">Une tablette à l'entrée gère les arrivées toute seule</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                Une application dédiée s'associe au compte de votre association et fonctionne en mode
                « kiosque » sur une tablette à l'entrée de la salle. L'élève passe sa carte et voit
                le signal vert de confirmation — l'enseignant démarre sa séance à l'heure au lieu de
                faire l'appel. (Disponible à partir de la formule Professionnel)
              </p>
            </Reveal>
            <Reveal delay={80}>
              <ScanDemo />
            </Reveal>
          </div>
        </div>
      </section>

      {/* AI assistant */}
      <section className="dark mk-dark-section mk-section">
        <div className="mk-container">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
            <Reveal>
              <p className="mk-eyebrow mb-3">Assistant intelligent — formule Avancé</p>
              <h2 className="mk-display mk-h3 max-w-[24ch]">Un assistant administratif qui comprend l'arabe et demande votre accord</h2>
              <p className="mk-body mt-4 max-w-[52ch] text-sm sm:text-base">
                « Combien d'élèves ont été absents cette semaine ? » — il répond immédiatement à
                partir de vos données. « Enregistre le paiement d'Ahmed pour mars » — il prépare
                l'opération et la présente dans une fiche de validation avant toute exécution. Chaque
                opération d'écriture passe par votre approbation explicite, et est consignée dans le
                journal d'activités au nom de celui qui l'a validée.
              </p>
            </Reveal>
            <Reveal delay={80}>
              <BrowserFrame>
                <ProductVideo
                  src={AI_VIDEO.src}
                  poster={AI_VIDEO.poster}
                  label="Enregistrement réel : l'assistant intelligent prépare une opération et attend la validation du directeur"
                />
              </BrowserFrame>
              <p className="mt-3 text-center text-xs text-foreground/50">
                Enregistrement réel de la plateforme — sans accélération ni montage
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="mk-section">
        <div className="mk-container text-center">
          <Reveal>
            <h2 className="mk-display mk-h3">La meilleure façon de comprendre la plateforme : la voir fonctionner</h2>
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

import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Politique de confidentialité",
  description: "Comment Q-Trust collecte, utilise et protège les données — y compris les données des élèves mineurs.",
}

const SECTIONS = [
  {
    title: "1. Qui sommes-nous et objet du présent document",
    body: [
      "La présente politique explique comment la plateforme Q-Trust (« la Plateforme ») traite les données personnelles lors de l'utilisation de notre site public et lors de l'utilisation de la Plateforme par les associations abonnées pour gérer leurs activités.",
      "Chaque association abonnée agit en tant que responsable du traitement des données de ses élèves et adhérents ; la Plateforme agit en tant que sous-traitant de ces données pour le compte de l'association et selon ses instructions.",
    ],
  },
  {
    title: "2. Données que nous traitons",
    body: [
      "Données du formulaire de demande de démo (site public) : nom, nom de l'association, ville, numéro de téléphone et e-mail le cas échéant — utilisées exclusivement pour donner suite à votre demande.",
      "Données opérationnelles (au sein de la Plateforme, saisies par l'association) : données des élèves — dont des mineurs — telles que nom, date de naissance, numéro de carte d'identité le cas échéant, photo, coordonnées du tuteur, historique de présence, cotisations mensuelles et documents pédagogiques.",
      "Données techniques nécessaires au fonctionnement et à la sécurité du service : journaux de connexion, adresse IP pour l'application des limites d'utilisation, et journal des activités administratives au sein du compte de l'association.",
    ],
  },
  {
    title: "3. Données des mineurs",
    body: [
      "La nature de l'activité des associations coraniques implique que la plupart des élèves sont mineurs. L'association saisit ces données en tant que responsable du traitement, avec le consentement des tuteurs selon ses propres procédures d'inscription.",
      "Nous nous engageons à leur égard à une isolation stricte entre associations (aucune association n'accède aux données d'une autre), à un contrôle d'accès par rôle au sein de l'association (directeur, enseignant, élève/parent), et à ne jamais utiliser les données des élèves à des fins commerciales.",
    ],
  },
  {
    title: "4. Où sont stockées les données et qui les traite pour notre compte",
    body: [
      "Base de données : MongoDB Atlas (hébergement cloud, chiffrement en transit et au repos).",
      "Photos et fichiers : Cloudinary, dans un dossier isolé par association.",
      "Assistant intelligent (formule Avancé) : les textes de conversation et les résultats de requêtes nécessaires sont transmis au fournisseur de modèle de langage Groq pour le traitement de la demande ; ils ne sont pas utilisés pour l'entraînement de modèles.",
      "Limitation d'utilisation et protection contre les abus : Upstash Redis.",
      "Nous ne vendons pas les données personnelles et ne les partageons avec aucun tiers en dehors de ces sous-traitants techniques.",
    ],
  },
  {
    title: "5. Durée de conservation",
    body: [
      "Données de demande de démo : conservées tant que la relation commerciale est active, supprimées sur demande.",
      "Données de l'association abonnée : conservées pendant la durée de l'abonnement. À la fin de l'abonnement, l'association peut demander une copie de ses données, qui sont ensuite supprimées de nos systèmes dans un délai raisonnable.",
    ],
  },
  {
    title: "6. Vos droits",
    body: [
      "Vous — et le tuteur de tout élève — avez le droit d'accès, de rectification, de suppression et de retrait du consentement, conformément à la loi tunisienne relative à la protection des données personnelles. Les demandes peuvent être adressées à votre association en tant que responsable du traitement, ou directement à nous via la page de contact — nous les transmettrons et contribuerons à leur exécution.",
    ],
  },
  {
    title: "7. Sécurité",
    body: [
      "Les mots de passe sont chiffrés par un algorithme de hachage fort et ne sont jamais stockés en clair. La connexion à la Plateforme est chiffrée via HTTPS. Les opérations sensibles sont consignées dans un journal d'activités indiquant qui les a effectuées et quand, y compris les opérations exécutées via l'assistant intelligent après validation du directeur.",
    ],
  },
  {
    title: "8. Mises à jour",
    body: [
      "Nous pouvons mettre à jour cette politique au fil de l'évolution de la Plateforme. Les modifications substantielles sont notifiées aux associations abonnées par e-mail au directeur inscrit avant leur entrée en vigueur.",
    ],
  },
]

export default function FrenchPrivacyPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Confiance & confidentialité</p>
          <h1 className="mk-display mk-h2">Politique de confidentialité</h1>
          <p className="mk-lead mt-5">
            Nous traitons les données de familles et d'élèves — dont beaucoup sont mineurs. Cette
            politique explique clairement ce que nous collectons, pourquoi, où c'est stocké et qui y
            a accès.
          </p>
          <p className="mt-3 text-xs text-foreground/50">Dernière mise à jour : août 2026</p>
        </Reveal>

        <div className="mt-14 max-w-3xl space-y-10">
          {SECTIONS.map((s, i) => (
            <Reveal key={s.title} delay={Math.min(i, 3) * 40}>
              <div>
                <h2 className="mk-display text-lg font-bold">{s.title}</h2>
                <div className="mt-3 space-y-2.5">
                  {s.body.map((p) => (
                    <p key={p.slice(0, 24)} className="mk-body text-sm">{p}</p>
                  ))}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}

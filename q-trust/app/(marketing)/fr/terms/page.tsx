import type { Metadata } from "next"
import { Reveal } from "@/components/marketing/reveal"

export const metadata: Metadata = {
  title: "Conditions d'utilisation",
  description: "Conditions régissant l'utilisation de la plateforme Q-Trust de gestion des associations et écoles coraniques.",
}

const SECTIONS = [
  {
    title: "1. Le service",
    body: [
      "La plateforme Q-Trust fournit un système cloud de gestion des associations et écoles coraniques : inscription des élèves, présence par QR, suivi des cotisations mensuelles, portail élève et parent, et selon la formule : application scanner et assistant intelligent.",
    ],
  },
  {
    title: "2. Comptes et autorisations",
    body: [
      "Les comptes de l'association sont créés lors de la souscription et le directeur reçoit des identifiants provisoires à modifier lors de la première connexion. L'association est responsable de la confidentialité de ses identifiants, de l'utilisation faite via ses comptes, de l'exactitude des données saisies et de l'obtention des consentements parentaux nécessaires.",
    ],
  },
  {
    title: "3. Formules et facturation",
    body: [
      "L'abonnement comprend des frais d'installation uniques et un abonnement annuel selon la formule convenue dans l'offre commerciale, payable par virement bancaire, chèque ou espèces contre facture.",
      "À l'expiration de la période annuelle sans renouvellement, l'accès au compte peut être suspendu après notification préalable, les données de l'association restant conservées conformément à la politique de confidentialité jusqu'au renouvellement ou à la demande de restitution.",
    ],
  },
  {
    title: "4. Propriété des données",
    body: [
      "Les données de l'association et de ses élèves appartiennent à l'association. L'association accorde à la Plateforme une licence de traitement exclusivement pour la fourniture du service. À la fin du contrat, l'association peut demander une copie de ses données avant leur suppression de nos systèmes.",
    ],
  },
  {
    title: "5. Utilisation acceptable",
    body: [
      "Il est interdit d'utiliser la Plateforme à des fins illégales, de tenter d'accéder aux données d'une autre association, de perturber le fonctionnement du service ou d'abuser de l'assistant intelligent. Nous nous réservons le droit de suspendre tout compte contrevenant après notification.",
    ],
  },
  {
    title: "6. Disponibilité du service et responsabilité",
    body: [
      "Nous faisons nos meilleurs efforts pour maintenir le service disponible en permanence, avec des maintenances planifiées annoncées à l'avance dans la mesure du possible. Nous ne sommes pas responsables des dommages indirects, et notre responsabilité totale est limitée au montant payé par l'association au cours de l'année d'abonnement en cours.",
    ],
  },
  {
    title: "7. Droit applicable",
    body: [
      "Les présentes conditions sont régies par le droit tunisien. Les tribunaux d'Ariana sont compétents pour tout litige n'ayant pas fait l'objet d'un règlement amiable.",
    ],
  },
]

export default function FrenchTermsPage() {
  return (
    <section className="pt-36 mk-section">
      <div className="mk-container">
        <Reveal className="max-w-[50ch]">
          <p className="mk-eyebrow mb-3">Confiance & confidentialité</p>
          <h1 className="mk-display mk-h2">Conditions d'utilisation</h1>
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

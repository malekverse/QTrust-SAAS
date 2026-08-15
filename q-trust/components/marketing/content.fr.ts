// Contenu marketing — version francophone (traduction du pitch validé,
// positionnement identique au fichier content.ts arabe).

// ── Indicateurs vérifiés (mêmes règles que l'arabe : aucun chiffre non
// vérifié — un bandeau vide vaut mieux qu'un faux). Renseigner ces
// constantes avec de VRAIES données agrégées active automatiquement les
// sections correspondantes. ──
export const PROOF_STATS: { label: string; value: number; suffix?: string }[] | null = null
// ex. [{ label: 'élèves inscrits', value: 480 }, { label: 'pointages enregistrés', value: 52000, suffix: '+' }]

export const TRUSTED_BY: { name: string; logoSrc?: string } | null = null
// Un vrai client, affiché avec son AUTORISATION écrite — ou rien.

export const TESTIMONIAL: { quote: string; name: string; role: string } | null = null
// Une vraie citation d'un vrai directeur client, avec autorisation — ou rien.

// ── Captures du produit (prises depuis le tenant de démo uniquement,
// jamais de données réelles d'élèves). Chaîne vide = le placeholder
// honnête s'affiche (ou un visuel produit codé quand il existe). ──
export const SHOTS = {
  dashboard: "/assets/dashboard.png",
  qrCheckin: "/assets/qr-checkin.webp",
  ledger: "/assets/ledger.png",
  scannerPhone: "",
}

// Enregistrement réel du flux IA proposer → approuver (boucle muette, recadrée) + poster.
export const AI_VIDEO = {
  src: "/assets/ai-propose.mp4",
  poster: "/assets/ai-propose-poster.jpg",
}

// Enregistrement du pointage scanner (boucle muette) — le poster est la même capture.
export const QR_VIDEO = {
  src: "/assets/qr-scanner.mp4",
  poster: "/assets/qr-checkin.webp",
}

// Séquence au défilement (moment signature) : le flux carte → balayage →
// confirmation, pré-rendu en frames webp dessinées sur canvas.
// Écrans larges + mouvement activé uniquement ; les autres voient l'image fixe.
export const SCRUB = {
  basePath: "/assets/scrub",
  count: 72,
  width: 1024,
  height: 576,
}

// ── Bandeau de confiance (phase early-stage) : faits produit vérifiables,
// aucun chiffre inventé. Remplacé par PROOF_STATS quand les vraies
// données agrégées sont disponibles. ──
export const TRUST_POINTS: { icon: "tunisia" | "shield" | "trial" | "onsite"; text: string }[] = [
  { icon: "tunisia", text: "Plateforme tunisienne, interface entièrement en arabe" },
  { icon: "shield", text: "Données de chaque association isolées et chiffrées" },
  { icon: "trial", text: "Essai gratuit de 14 jours, sans engagement" },
  { icon: "onsite", text: "Installation et formation dans vos locaux" },
]

export const HERO = {
  headlineLines: ["Remplacez les registres papier", "par un système numérique complet"],
  goldPhrase: "par un système numérique complet",
  subhead:
    "Q-Trust centralise le pointage des élèves par QR code, le suivi des paiements et les rapports de suivi — le tout dans une plateforme unique conçue pour les associations coraniques.",
  ctaPrimary: "Réserver une démo",
  ctaSecondary: "Voir la plateforme",
}

// Les trois points de friction du directeur, issus du pitch terrain.
export const PILLARS = [
  {
    title: "Gagnez du temps à chaque séance",
    body: "Un scan de carte QR enregistre la présence en une seconde. Fini l'appel nominal, le cahier rempli à la main, puis la ressaisie dans un tableur en fin de mois.",
    icon: "qr" as const,
  },
  {
    title: "Plus aucune absence passée sous silence",
    body: "Le tableau de bord affiche les absences du jour dès le début de la séance, avec un historique complet par élève. Le parent ne découvre plus le décrochage un mois après.",
    icon: "eye" as const,
  },
  {
    title: "Sachez qui a payé et qui est en retard",
    body: "Un registre mensuel par élève : payé ou en retard, en un clic, avec export prêt pour les rapports financiers de l'association.",
    icon: "ledger" as const,
  },
]

// Les trois étapes de la visite produit.
export const TOUR_BEATS = [
  {
    key: "qr",
    title: "Pointage par QR code",
    caption: "L'élève passe sa carte devant la caméra — sa présence est enregistrée instantanément, avec un signal vert visible par le superviseur.",
    shot: "qrCheckin" as const,
  },
  {
    key: "dashboard",
    title: "Tableau de bord en temps réel",
    caption: "En un coup d'oeil : séances du jour, taux de présence, absences et demandes en attente — des chiffres réels, mis à jour en direct.",
    shot: "dashboard" as const,
  },
  {
    key: "ledger",
    title: "Registre des paiements",
    caption: "Les cotisations de chaque mois sous vos yeux : qui a payé, qui est en retard, total des recettes — sans cahiers ni tableurs éparpillés.",
    shot: "ledger" as const,
  },
]

export const AI_SPOTLIGHT = {
  eyebrow: "Assistant intelligent — formule Avancé",
  title: "Demandez en arabe, validez avant toute exécution",
  body: "Écrivez votre demande comme vous le diriez à un assistant administratif : « Enregistre le paiement d'Ahmed pour le mois de mars ». L'assistant recherche, prépare l'opération, puis vous la présente dans une fiche de validation. Aucune modification n'est appliquée sans votre approbation explicite.",
  typedRequest: "Enregistre le paiement d'Ahmed Ben Ali pour mars",
  actionDescription: "Enregistrement d'un paiement mensuel — Ahmed Ben Ali, mars",
  approveLabel: "Approuver et exécuter",
  rejectLabel: "Refuser",
}

export const SCANNER = {
  eyebrow: "Application scanner + cartes QR",
  title: "Une tablette à l'entrée, une carte pour chaque élève",
  body: "Une application scanner dédiée fonctionne sur une tablette placée à l'entrée de la salle : l'élève passe sa carte, le système fait le reste. Des cartes PVC avec identifiant QR unique sont imprimées pour chaque élève et remises à l'inscription.",
  bullets: [
    "Fonctionne sans intervention de l'enseignant — la séance démarre à l'heure",
    "Cartes PVC imprimées au nom de votre association (service complémentaire)",
    "Signal de confirmation vert, visible par l'élève et le superviseur",
  ],
}

// Grille tarifaire de référence — valeurs d'affichage uniquement ;
// les conditions terrain sont négociées au cas par cas.
export const PRICING_TIERS = [
  {
    key: "starter",
    name: "Essentiel",
    setup: "0 DT",
    annual: "0 DT / an",
    cap: "Jusqu'à 50 élèves",
    highlight: false,
    unlocks: "Démarrez gratuitement : pointage QR depuis le navigateur et registre de paiements basique.",
    features: [
      "Pointage par QR code depuis le navigateur",
      "Registre de paiements basique",
      "Un siège administrateur",
      "Essai gratuit de 14 jours",
    ],
  },
  {
    key: "standard",
    name: "Professionnel",
    setup: "À partir de 600 DT",
    annual: "350–450 DT / an",
    cap: "Jusqu'à 300 élèves",
    highlight: false,
    unlocks: "Scanner sur tablette, opérations groupées et portail parent.",
    features: [
      "Tout le contenu d'Essentiel",
      "Connexion de l'application scanner sur tablette",
      "Paiements groupés et export CSV",
      "Portail élève et parent",
      "Bibliothèque de documents pédagogiques",
    ],
  },
  {
    key: "premium",
    name: "Avancé",
    setup: "1 100 DT",
    annual: "650 DT / an",
    cap: "Nombre d'élèves illimité",
    highlight: true,
    unlocks: "Assistant intelligent en arabe et gestion multi-sites — sans limite d'élèves.",
    features: [
      "Tout le contenu de Professionnel",
      "Assistant intelligent en arabe (validation requise pour chaque opération)",
      "Gestion multi-sites",
      "Support technique prioritaire",
    ],
  },
]

export const FINAL_CTA = {
  title: "Prêt à voir votre plateforme fonctionner avec les données de votre association ?",
  body: "Réservez une démo en direct — nous nous déplaçons chez vous ou nous organisons une session à distance. Vous verrez le pointage et les paiements en action.",
  cta: "Réserver une démo",
}

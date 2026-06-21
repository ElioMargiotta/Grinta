/**
 * Bibliothèque d'indicateurs par défaut — physique / technique / médical.
 *
 * Catalogue prêt à l'emploi pour un club amateur/semi-pro : chaque indicateur
 * porte une description, un protocole standardisé et les métadonnées permettant
 * une interprétation correcte dans le temps. Un club active les indicateurs
 * voulus depuis la page Évaluation (insertion dans `physical_metrics`, tracée
 * par `default_key`). Extensible : ajouter une entrée ici suffit.
 */

export type MetricCategory = "physical" | "technical" | "medical";
export type MetricInterpretation = "higher" | "lower" | "target";
export type MetricValueType =
  | "integer"
  | "decimal"
  | "percentage"
  | "score"
  | "number";
export type MetricDisplay = "primary" | "secondary";

export type DefaultMetric = {
  /** Clé stable, sert d'idempotence à l'activation (physical_metrics.default_key). */
  key: string;
  name: string;
  category: MetricCategory;
  subcategory: string;
  unit: string;
  valueType: MetricValueType;
  interpretation: MetricInterpretation;
  description: string;
  protocol: string;
  material: string[];
  trials: string;
  validityConditions: string;
  recommendedFrequency: string;
  display: MetricDisplay;
  /** Seuil d'alerte (surtout indicateurs médicaux). */
  alertThreshold?: number;
};

export const DEFAULT_METRIC_LIBRARY: DefaultMetric[] = [
  {
    key: "vma",
    name: "VMA estimée",
    category: "physical",
    subcategory: "endurance_aerobie",
    unit: "km/h",
    valueType: "decimal",
    interpretation: "higher",
    description:
      "Estimation de la vitesse maximale aérobie du joueur, utile pour suivre l'endurance et calibrer les intensités d'entraînement.",
    protocol:
      "Échauffement standardisé de 10 à 15 minutes. Réaliser un test progressif type VAMEVAL, demi-Cooper ou protocole club validé. Le joueur court jusqu'au décrochage. La vitesse finale ou estimée est enregistrée.",
    material: ["terrain", "plots", "chrono ou audio", "feuille de score"],
    trials: "1 essai",
    validityConditions:
      "Joueur frais, pas de douleur, surface stable, protocole identique à chaque mesure.",
    recommendedFrequency: "Toutes les 6 à 8 semaines",
    display: "primary",
  },
  {
    key: "yoyo_ir1",
    name: "Yo-Yo IR1",
    category: "physical",
    subcategory: "endurance_intermittente",
    unit: "m",
    valueType: "integer",
    interpretation: "higher",
    description:
      "Mesure la capacité du joueur à répéter des efforts intenses avec des récupérations courtes, proche des exigences intermittentes du football.",
    protocol:
      "Deux lignes espacées de 20 m et une zone de récupération de 5 m. Navettes à vitesse imposée par une bande sonore, avec 10 s de récupération active entre les courses. Arrêt lorsque le joueur ne suit plus le rythme à plusieurs reprises.",
    material: ["plots", "bande sonore Yo-Yo IR1", "enceinte", "feuille de score"],
    trials: "1 essai",
    validityConditions:
      "Surface stable, joueur frais, respect des lignes, arrêt selon critère standardisé.",
    recommendedFrequency: "Pré-saison, mi-saison, ou toutes les 8 à 12 semaines",
    display: "primary",
  },
  {
    key: "jonglage",
    name: "Jonglage libre",
    category: "technical",
    subcategory: "maitrise_ballon",
    unit: "touches",
    valueType: "integer",
    interpretation: "higher",
    description:
      "Évalue la coordination, le toucher de balle, la concentration et la maîtrise technique individuelle.",
    protocol:
      "Le joueur réalise un maximum de jongles sans que le ballon touche le sol (variante par défaut : jonglage libre). Trois essais, meilleur score retenu.",
    material: ["ballon adapté à la catégorie d'âge", "surface plane"],
    trials: "3 essais, meilleur score retenu",
    validityConditions:
      "Même type de ballon, même surface, ballon contrôlé, pas d'utilisation des mains (sauf gardiens si protocole spécifique).",
    recommendedFrequency: "Mensuelle",
    display: "primary",
  },
  {
    key: "douleur",
    name: "Douleur déclarée",
    category: "medical",
    subcategory: "douleur_disponibilite",
    unit: "0-10",
    valueType: "integer",
    interpretation: "lower",
    description:
      "Auto-évaluation du niveau de douleur ou gêne ressenti par le joueur avant ou après une séance.",
    protocol:
      "Le joueur indique son niveau de douleur de 0 (aucune) à 10 (maximale). Localisation obligatoire si la valeur est supérieure à 0.",
    material: ["questionnaire joueur"],
    trials: "1 réponse par séance ou match",
    validityConditions:
      "Réponse individuelle, sans influence du groupe. Douleur élevée ou récurrente à signaler au staff.",
    recommendedFrequency: "Avant chaque séance et après match si nécessaire",
    display: "primary",
    alertThreshold: 5,
  },
  {
    key: "disponibilite",
    name: "Disponibilité médicale",
    category: "medical",
    subcategory: "disponibilite",
    unit: "%",
    valueType: "percentage",
    interpretation: "higher",
    description:
      "Indique la capacité du joueur à participer pleinement à l'entraînement ou au match.",
    protocol:
      "Statut renseigné : complet (100 %), limité (50 %), retour progressif, indisponible (0 %). Peut être converti en pourcentage.",
    material: ["questionnaire", "validation staff optionnelle"],
    trials: "1 statut par séance ou match",
    validityConditions:
      "À confirmer par le coach ou le staff médical en cas de douleur, blessure ou retour progressif.",
    recommendedFrequency: "Avant chaque séance et match",
    display: "primary",
    alertThreshold: 70,
  },
  {
    key: "fatigue",
    name: "Fatigue perçue",
    category: "medical",
    subcategory: "fatigue_recuperation",
    unit: "1-10",
    valueType: "integer",
    interpretation: "lower",
    description:
      "Évalue l'état de fatigue ressenti par le joueur afin d'adapter la charge d'entraînement.",
    protocol:
      "Avant la séance, le joueur note son niveau de fatigue de 1 (très frais) à 10 (extrêmement fatigué).",
    material: ["questionnaire joueur"],
    trials: "1 réponse",
    validityConditions: "Réponse individuelle, idéalement collectée avant l'échauffement.",
    recommendedFrequency: "Avant chaque séance",
    display: "primary",
    alertThreshold: 8,
  },
  {
    key: "sommeil",
    name: "Qualité du sommeil",
    category: "medical",
    subcategory: "recuperation",
    unit: "1-5",
    valueType: "score",
    interpretation: "higher",
    description:
      "Indicateur simple de récupération basé sur le sommeil ressenti par le joueur.",
    protocol:
      "Avant la séance, le joueur évalue son sommeil : 1 très mauvais, 2 mauvais, 3 moyen, 4 bon, 5 excellent. Durée de sommeil optionnelle.",
    material: ["questionnaire joueur"],
    trials: "1 réponse",
    validityConditions: "Réponse individuelle, non jugée par le groupe.",
    recommendedFrequency: "Avant chaque séance ou quotidiennement en période intense",
    display: "secondary",
  },
  {
    key: "rpe",
    name: "RPE séance",
    category: "medical",
    subcategory: "charge_interne",
    unit: "1-10",
    valueType: "integer",
    interpretation: "target",
    description:
      "Évalue la difficulté globale ressentie de la séance. Sert au calcul de la charge interne.",
    protocol:
      "15 à 30 minutes après la séance, demander : « Quelle difficulté globale as-tu ressentie ? » sur une échelle de 1 à 10.",
    material: ["questionnaire joueur"],
    trials: "1 réponse par séance",
    validityConditions:
      "Réponse individuelle, collectée après la séance, sans influence du groupe.",
    recommendedFrequency: "Après chaque séance",
    display: "primary",
  },
  {
    key: "charge_interne",
    name: "Charge interne",
    category: "medical",
    subcategory: "charge",
    unit: "AU",
    valueType: "number",
    interpretation: "target",
    description:
      "Charge d'entraînement estimée à partir de la durée de séance et de la difficulté ressentie.",
    protocol: "Calcul : charge interne = durée de séance en minutes × RPE séance.",
    material: ["durée de séance", "RPE"],
    trials: "1 calcul par séance",
    validityConditions: "Nécessite une durée exacte et un RPE valide.",
    recommendedFrequency: "Après chaque séance",
    display: "primary",
  },
];

/** `higher_is_better` rétro-compatible déduit du sens d'interprétation. */
export function higherIsBetterFromInterpretation(
  interpretation: MetricInterpretation | string,
): boolean {
  return interpretation !== "lower";
}

/** Champs normalisés d'un indicateur, partagés UI ↔ server actions. */
export type MetricFields = {
  name: string;
  category: string | null;
  subcategory: string | null;
  unit: string | null;
  valueType: string | null;
  interpretation: string;
  description: string | null;
  protocol: string | null;
  material: string[] | null;
  trials: string | null;
  validityConditions: string | null;
  recommendedFrequency: string | null;
  display: string;
  alertThreshold: number | null;
};

/** Mappe les champs normalisés vers les colonnes de `physical_metrics`. */
export function metricFieldsToRow(fields: MetricFields) {
  return {
    name: fields.name,
    category: fields.category,
    subcategory: fields.subcategory,
    unit: fields.unit,
    value_type: fields.valueType,
    interpretation: fields.interpretation,
    higher_is_better: higherIsBetterFromInterpretation(fields.interpretation),
    description: fields.description,
    protocol: fields.protocol,
    material: fields.material,
    trials: fields.trials,
    validity_conditions: fields.validityConditions,
    recommended_frequency: fields.recommendedFrequency,
    display: fields.display,
    alert_threshold: fields.alertThreshold,
  };
}

export const METRIC_CATEGORIES: MetricCategory[] = [
  "physical",
  "technical",
  "medical",
];

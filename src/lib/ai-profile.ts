export const AI_PERSONAS = [
  "drill_sergeant",
  "mentor",
  "analyst",
  "hype_man",
] as const;

export type AIPersona = (typeof AI_PERSONAS)[number];

export const DEFAULT_AI_PERSONA: AIPersona = "mentor";

export const MAX_CORE_WHY_LENGTH = 240;
export const MAX_CUSTOM_INSTRUCTIONS_LENGTH = 400;

export interface AIProfileOption {
  value: AIPersona;
  label: string;
  shortDescription: string;
  promptInstructions: string;
}

export const AI_PERSONA_OPTIONS: AIProfileOption[] = [
  {
    value: "drill_sergeant",
    label: "The Drill Sergeant",
    shortDescription: "Tough love, aggressive accountability, zero excuses.",
    promptInstructions:
      "Be blunt, urgent, and accountability-heavy. Push for immediate action, reject excuse-making, and keep the user moving without becoming cruel or insulting.",
  },
  {
    value: "mentor",
    label: "The Mentor",
    shortDescription: "Empathetic, steady, and supportive without losing clarity.",
    promptInstructions:
      "Be calm, supportive, and emotionally intelligent. Encourage sustainable progress, acknowledge effort, and guide the user toward the next practical step.",
  },
  {
    value: "analyst",
    label: "The Analyst",
    shortDescription: "Data-driven, diagnostic, and optimization focused.",
    promptInstructions:
      "Be diagnostic, precise, and metrics-first. Focus on trends, causes, inefficiencies, and concrete optimizations more than emotional language.",
  },
  {
    value: "hype_man",
    label: "The Hype Man",
    shortDescription: "High-energy, momentum-building, and relentlessly positive.",
    promptInstructions:
      "Be energetic, celebratory, and motivating. Highlight wins, build momentum, and channel excitement into immediate action.",
  },
];

export interface ExplicitAIProfile {
  persona: AIPersona;
  coreWhy: string;
  customInstructions: string;
}

export interface StoredAIProfile extends ExplicitAIProfile {
  implicitMemory: string;
  implicitMemoryUpdatedAt: Date | null;
  implicitMemoryLastEvaluatedLogAt: Date | null;
  implicitMemoryLastEvaluatedChatAt: Date | null;
  implicitMemoryPending: boolean;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value !== "string" || !value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function sanitizeProfileText(
  value: unknown,
  maxLength?: number
): string {
  if (typeof value !== "string") {
    return "";
  }

  const trimmed = value.trim();
  return maxLength !== undefined ? trimmed.slice(0, maxLength) : trimmed;
}

export function isValidAIPersona(value: unknown): value is AIPersona {
  return AI_PERSONAS.includes(value as AIPersona);
}

export function getDefaultExplicitAIProfile(): ExplicitAIProfile {
  return {
    persona: DEFAULT_AI_PERSONA,
    coreWhy: "",
    customInstructions: "",
  };
}

export function getDefaultStoredAIProfile(): StoredAIProfile {
  return {
    ...getDefaultExplicitAIProfile(),
    implicitMemory: "",
    implicitMemoryUpdatedAt: null,
    implicitMemoryLastEvaluatedLogAt: null,
    implicitMemoryLastEvaluatedChatAt: null,
    implicitMemoryPending: false,
  };
}

export function parseExplicitAIProfile(
  input: unknown,
  options: { requirePersona?: boolean } = {}
):
  | { ok: true; value: ExplicitAIProfile }
  | { ok: false; error: string } {
  if (input === null || input === undefined || typeof input !== "object") {
    return options.requirePersona
      ? { ok: false, error: "AI coach persona is required" }
      : { ok: true, value: getDefaultExplicitAIProfile() };
  }

  const record = input as Record<string, unknown>;
  const persona = record.persona;

  if (options.requirePersona && !isValidAIPersona(persona)) {
    return { ok: false, error: "AI coach persona is required" };
  }

  return {
    ok: true,
    value: {
      persona: isValidAIPersona(persona) ? persona : DEFAULT_AI_PERSONA,
      coreWhy: sanitizeProfileText(record.coreWhy, MAX_CORE_WHY_LENGTH),
      customInstructions: sanitizeProfileText(
        record.customInstructions,
        MAX_CUSTOM_INSTRUCTIONS_LENGTH
      ),
    },
  };
}

export function getStoredAIProfile(input: unknown): StoredAIProfile {
  if (input === null || input === undefined || typeof input !== "object") {
    return getDefaultStoredAIProfile();
  }

  const defaults = getDefaultStoredAIProfile();
  const record = input as Record<string, unknown>;

  return {
    persona: isValidAIPersona(record.persona)
      ? record.persona
      : defaults.persona,
    coreWhy: sanitizeProfileText(record.coreWhy, MAX_CORE_WHY_LENGTH),
    customInstructions: sanitizeProfileText(
      record.customInstructions,
      MAX_CUSTOM_INSTRUCTIONS_LENGTH
    ),
    implicitMemory: sanitizeProfileText(
      record.implicitMemory
    ),
    implicitMemoryUpdatedAt: parseDate(record.implicitMemoryUpdatedAt),
    implicitMemoryLastEvaluatedLogAt: parseDate(
      record.implicitMemoryLastEvaluatedLogAt
    ),
    implicitMemoryLastEvaluatedChatAt: parseDate(
      record.implicitMemoryLastEvaluatedChatAt
    ),
    implicitMemoryPending: record.implicitMemoryPending === true,
  };
}

export function getExplicitAIProfileResponse(
  input: unknown
): ExplicitAIProfile {
  const profile = getStoredAIProfile(input);

  return {
    persona: profile.persona,
    coreWhy: profile.coreWhy,
    customInstructions: profile.customInstructions,
  };
}

export function getPersonaOption(persona: AIPersona): AIProfileOption {
  return (
    AI_PERSONA_OPTIONS.find((option) => option.value === persona) ??
    AI_PERSONA_OPTIONS[0]
  );
}

export function getPersonaPromptInstructions(persona: AIPersona): string {
  return getPersonaOption(persona).promptInstructions;
}

export interface AIProfileWithMemoryMeta extends ExplicitAIProfile {
  implicitMemory: string;
  implicitMemoryUpdatedAt: Date | null;
}

export function getAIProfileWithMemoryMeta(
  input: unknown
): AIProfileWithMemoryMeta {
  const profile = getStoredAIProfile(input);

  return {
    persona: profile.persona,
    coreWhy: profile.coreWhy,
    customInstructions: profile.customInstructions,
    implicitMemory: profile.implicitMemory,
    implicitMemoryUpdatedAt: profile.implicitMemoryUpdatedAt,
  };
}

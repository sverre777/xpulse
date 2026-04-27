// Konstanter delt mellom server-action-filen (coach-settings.ts) og UI-sidene.
// Holdes utenfor "use server"-filen fordi server action-filer kun kan eksportere
// async-funksjoner.

export const REMINDER_THRESHOLDS = [3, 7, 14] as const

// Analyse v2 bolk 7: konstanter for Klokkedata som BÅDE server-action og
// klient trenger. Ligger utenfor 'use server'-fila med vilje — en 'use server'-
// fil kan bare eksportere async-funksjoner (en eksportert const gir 500 på hele
// action-chunken, jf. regelen om type-re-eksport).

/** Pulsmålene «fart ved gitt puls» regnes for (brukeren velger inntil tre i grafen). */
export const PULS_MAAL = [120, 130, 140, 150, 160, 170] as const

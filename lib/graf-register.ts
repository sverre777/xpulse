// GRAF-REGISTERET (Analyse v2 bolk 1, Sverre 5. sep 2026). ÉN liste over alle
// grafer og nøkkeltallkort i Analyse: chartKey → fane, tittel, datakilde.
// Erstatter CHART_META i den gamle favorittseksjonen. ChartWrapper og
// MetricCard sjekker nøkkelen sin mot registeret (dev-varsel når den mangler),
// Favoritter-fanen leser fane/tittel herfra, og AnalysisPage vet hvilken
// datakilde en favoritt trenger. Ren logikk — ingen react.
//
// Nøkler: stabile snake_case med faneprefiks. De gamle nøklene (overview_*,
// klokke_*, bevegelse_*, mal_analyse_*, intensity_*, competitions_*, …)
// overlever som de er; avløste nøkler mappes i NOKKEL_ALIAS så gamle
// stjerner i prod peker på arvtakeren. Ingen SQL.

export type FaneKey =
  | 'favoritter' | 'oversikt' | 'klokkedata' | 'belastning' | 'prestasjon' | 'terskel' | 'skyting'
  | 'sammenlign' | 'standardokter' | 'konkurranser' | 'tester_pr' | 'ski_tester' | 'helse'
  | 'ernering' | 'vaer' | 'hoyde_varme' | 'per_bevegelsesform' | 'intensitet'
  | 'periodisering' | 'mal_analyse' | 'styrke'

/** Datasettene AnalysisPage henter — én server-action per sett. 'selv' =
    komponenten henter selv (custom-grafer, sesong, skuddmål). */
export type DataKey =
  | 'oversikt' | 'klokkedata' | 'belastning' | 'prestasjon' | 'terskel' | 'skyting'
  | 'sammenlign' | 'mal_analyse' | 'periodisering' | 'konkurranser' | 'tester_pr' | 'ski_tester'
  | 'helse' | 'helse_korrelasjon' | 'helse_belastning' | 'ernering' | 'vaer' | 'hoyde_varme' | 'per_bevegelsesform' | 'intensitet'
  | 'styrke'
  | 'selv'

export const FANE_NAVN: Record<FaneKey, string> = {
  favoritter: 'Favoritter',
  oversikt: 'Oversikt',
  klokkedata: 'Klokkedata-trender',
  belastning: 'Belastning',
  prestasjon: 'Prestasjon',
  terskel: 'Terskel',
  skyting: 'Skyting-dybde',
  sammenlign: 'Sammenligning',
  standardokter: 'Standardøkter',
  konkurranser: 'Konkurranser',
  tester_pr: 'Tester & PR',
  ski_tester: 'Ski-tester',
  helse: 'Helse',
  ernering: 'Ernæring',
  vaer: 'Vær/føre',
  hoyde_varme: 'Høyde & varme',
  per_bevegelsesform: 'Per bevegelsesform',
  intensitet: 'Intensitetsfordeling',
  periodisering: 'Årsplan-analyse',
  mal_analyse: 'Mal-analyse',
  styrke: 'Styrke',
}

export interface GrafDef {
  fane: FaneKey
  tittel: string
  /** Datasettet favoritten trenger. Standard = fanens eget. */
  data?: DataKey
  /** Grafen har egne innstillinger (custom-graf). Favoritt MED lagret
      oppsett venter på config-kolonne (SQL vist, ikke kjørt) — til da
      favoriseres grafen med standardoppsettet. */
  config?: boolean
  /** Kortet er bygget for FULL bredde (statuskortet, tabeller, brede rader).
      Favoritt-lista legger da kortet over begge kolonnene, så det ser likt ut
      som i sin egen fane (Sverre 6. sep: favoritter ble klemt på PC). */
  bred?: boolean
}

const G = (fane: FaneKey, tittel: string, mer: Partial<GrafDef> = {}): GrafDef => ({ fane, tittel, ...mer })

export const GRAFER: Record<string, GrafDef> = {
  // ── Oversikt ──
  overview_hours_per_week: G('oversikt', 'Treningstimer per uke'),
  overview_zones_per_week: G('oversikt', 'Sonefordeling per uke'),
  overview_km_per_movement: G('oversikt', 'Kilometer per bevegelsesform'),
  overview_intensive_sessions: G('oversikt', 'Intensive økter per uke'),
  overview_training_vs_rest_vs_sickness: G('oversikt', 'Trening vs hvile vs sykdom per uke'),
  overview_rest_days: G('oversikt', 'Hviledager 🛌'),
  overview_sickness_days: G('oversikt', 'Sykdomsdager 🤒'),
  overview_average_energy: G('oversikt', 'Snitt overskudd 🙂'),
  overview_average_stress: G('oversikt', 'Snitt stress 😰'),
  overview_custom_breakdown: G('oversikt', 'Custom graf — fleksibel nedbryting', { data: 'selv', config: true }),
  // BOLK A (6. sep): «STATUS NÅ»-kortet øverst i Oversikt. Boksene får egne nøkler i A2/A3.
  oversikt_status_kort: G('oversikt', 'Status nå (statuskortet)', { bred: true }),
  oversikt_status_siste_hard: G('oversikt', 'Status nå — siste hardøkt'),
  oversikt_status_neste: G('oversikt', 'Status nå — neste hardøkt og neste økt'),
  oversikt_status_plan: G('oversikt', 'Status nå — timer plan vs gjennomført'),
  oversikt_status_soner: G('oversikt', 'Status nå — soner og volum (uke/måned/år)'),
  oversikt_status_skyting: G('oversikt', 'Status nå — skyting'),
  oversikt_status_bevform: G('oversikt', 'Status nå — bevegelsesformer'),
  oversikt_status_belastning: G('oversikt', 'Status nå — belastning (CTL/ATL/TSB)'),
  oversikt_status_helse: G('oversikt', 'Status nå — helse 30 dager'),
  oversikt_hovedtall: G('oversikt', 'Hovedtall (tid · km · økter · konkurranser)'),
  oversikt_total_tid: G('oversikt', 'Total tid'),
  oversikt_total_km: G('oversikt', 'Total km'),
  oversikt_antall_okter: G('oversikt', 'Antall økter'),
  oversikt_konkurranser: G('oversikt', 'Konkurranser'),
  oversikt_sonefordeling: G('oversikt', 'Sonefordeling'),
  oversikt_bevegelsesformer: G('oversikt', 'Bevegelsesformer'),
  oversikt_tempo: G('oversikt', 'Tempo'),
  oversikt_skytetreff: G('oversikt', 'Skyte-treff'),
  oversikt_hovedsport_km: G('oversikt', 'Hovedsport-km'),
  oversikt_styrkeokter: G('oversikt', 'Styrke-økter'),
  oversikt_hoydemeter: G('oversikt', 'Høydemeter'),
  oversikt_snitt_hrv: G('oversikt', 'Snitt HRV'),
  oversikt_snitt_hvilepuls: G('oversikt', 'Snitt hvilepuls'),
  oversikt_snitt_sovn: G('oversikt', 'Snitt søvn'),
  oversikt_snittvekt: G('oversikt', 'Snittvekt'),
  oversikt_plan_vs_faktisk: G('oversikt', 'Plan vs faktisk', { data: 'selv' }),
  oversikt_planlagt_volum: G('oversikt', 'Planlagt volum'),
  oversikt_sesong_mot_sesong: G('oversikt', 'Sesong mot sesong', { data: 'selv', config: true }),

  // ── Klokkedata-trender ──
  klokke_zones_per_week: G('klokkedata', 'Tid i sone per uke'),
  klokke_power_curve: G('klokkedata', 'Power curve'),
  klokke_suffer_score: G('klokkedata', 'Suffer score'),
  klokke_cadence: G('klokkedata', 'Kadens-utvikling'),
  klokkedata_dekning: G('klokkedata', 'Klokkesync-dekning'),
  // Bolk 7: rå klokkedata — utvikling bor i Prestasjon, NP/IF + watt-soner i Terskel (lenket).
  klokke_pace_curve: G('klokkedata', 'Pace-kurve'),
  klokke_hoydemeter_per_uke: G('klokkedata', 'Høydemeter per uke'),
  klokke_fart_ved_puls: G('klokkedata', 'Fart ved gitt puls', { config: true }),
  klokke_watt_per_kg: G('klokkedata', 'Watt/kg per økt'),

  // ── Belastning ──
  belastning_fitness_fatigue_form: G('belastning', 'Belastningskurver (CTL/ATL/TSB)'),
  belastning_daily_tss: G('belastning', 'Daglig treningsbelastning (TSS)'),
  belastning_perceived_vs_calculated: G('belastning', 'Opplevd vs. beregnet belastning'),
  belastning_energy_stress_over_time: G('belastning', 'Overskudd og stress over tid'),
  belastning_rest_day_stats: G('belastning', 'Hviledag-statistikk'),
  belastning_status: G('belastning', 'Belastningsstatus (CTL · ATL · TSB · form)'),
  // Bolk 4 — helse mot belastning (datasett helse_belastning)
  belastning_helse_kurver: G('belastning', 'HRV og hvilepuls mot belastning', { data: 'helse_belastning', config: true }),
  belastning_klar: G('belastning', 'Klar for belastning', { data: 'helse_belastning' }),
  belastning_korrelasjoner: G('belastning', 'Korrelasjonskort (alle)', { data: 'helse_belastning' }),
  belastning_korr_hrv_tsb: G('belastning', 'HRV vs form (TSB)', { data: 'helse_belastning' }),
  belastning_korr_hvilepuls_atl: G('belastning', 'Hvilepuls vs tretthet (ATL)', { data: 'helse_belastning' }),
  belastning_korr_sovn_opplevd: G('belastning', 'Søvn vs opplevd neste dag', { data: 'helse_belastning' }),
  belastning_korr_dagsform_ef: G('belastning', 'Dagsform vs EF', { data: 'helse_belastning' }),
  belastning_korr_sovn_treff: G('belastning', 'Søvn vs treff %', { data: 'helse_belastning' }),
  belastning_korr_hrv_treff: G('belastning', 'HRV vs treff %', { data: 'helse_belastning' }),
  belastning_korr_vekt_wattkg: G('belastning', 'Vekt vs watt per kg', { data: 'helse_belastning' }),
  belastning_rpe_vs_tss: G('belastning', 'Opplevd vs TSS per økt', { data: 'helse_belastning', config: true }),
  belastning_custom: G('belastning', 'Custom belastningsgraf', { data: 'helse_belastning', config: true }),
  belastning_ctl: G('belastning', 'Fitness (CTL)'),
  belastning_atl: G('belastning', 'Fatigue (ATL)'),
  belastning_tsb: G('belastning', 'Form (TSB)'),
  belastning_formstatus: G('belastning', 'Formstatus'),

  // ── Prestasjon ──
  prestasjon_ef: G('prestasjon', 'Effektivitetsfaktor'),
  prestasjon_frakobling: G('prestasjon', 'Aerob frakobling'),
  // Bolk 3
  prestasjon_gap: G('prestasjon', 'GAP-tempo over tid', { config: true }),
  prestasjon_fart_ved_terskel: G('prestasjon', 'Fart / watt ved terskelpuls', { config: true }),
  prestasjon_kurve_over_tid: G('prestasjon', 'Power- / tempokurve over tid', { config: true }),
  prestasjon_kadens_vs_fart: G('prestasjon', 'Kadens vs fart'),
  prestasjon_konkurranse_vs_form: G('prestasjon', 'Konkurranse vs form'),

  // ── Terskel ──
  terskel_lactate_profile: G('terskel', 'Laktatprofil (mmol vs puls)'),
  terskel_lactate_trend: G('terskel', 'Laktat over tid'),
  terskel_laktat_per_mal: G('terskel', 'Laktat-respons per mal'),
  terskel_estimat: G('terskel', 'Terskel-estimat (LT1 · LT2 · profil · datapunkter)'),
  // Bolk 2
  terskel_historikk: G('terskel', 'Terskel over tid (puls · tempo · FTP)', { config: true }),
  terskel_estimater: G('terskel', 'Estimert vs testet'),
  terskel_hfmax: G('terskel', 'HFmax (ført · formel · % ved terskel)'),
  terskel_hfmax_fort: G('terskel', 'HFmax ført'),
  terskel_hfmax_formel: G('terskel', 'HFmax formel'),
  terskel_hfmax_pct: G('terskel', '% av HFmax ved terskel'),
  terskel_watt_per_kg: G('terskel', 'Watt per kg'),
  terskel_watt_soner_per_uke: G('terskel', 'Tid i watt-sone per uke'),
  terskel_np_if_per_okt: G('terskel', 'NP og IF per økt'),
  terskel_laktat_vs_intensitet: G('terskel', 'Laktat ved samme fart / watt', { config: true }),
  terskel_lt1: G('terskel', 'LT1 (2 mmol)'),
  terskel_lt2: G('terskel', 'LT2 (4 mmol)'),
  terskel_profil: G('terskel', 'Profil-terskel'),
  terskel_datapunkter: G('terskel', 'Datapunkter'),

  // ── Skyting-dybde ──
  skyting_custom: G('skyting', 'Custom skyting-graf', { config: true }),
  // Bolk 8: de faste grafene som manglet (pivoten bor i skyting_custom)
  skyting_treff_vs_pulsinn: G('skyting', 'Treff mot puls inn'),
  skyting_treff_vs_skytetid: G('skyting', 'Treff mot skytetid'),
  skyting_skytetid_ligg_staa: G('skyting', 'Skytetid liggende vs stående'),
  skyting_plott_heatmap: G('skyting', 'Skuddplott-heatmap', { config: true }),
  skyting_bomretning: G('skyting', 'Bom-retning over tid'),
  skyting_accuracy_over_time: G('skyting', 'Treff% per stilling over tid'),
  skyting_accuracy_hr_zones: G('skyting', 'Treff% i puls-soner'),
  skyting_wind_accuracy: G('skyting', 'Treff% i vind og sikt'),
  skyting_time_per_series: G('skyting', 'Skytetid-progresjon'),
  skyting_training_vs_comp: G('skyting', 'Trening vs. konkurranse'),
  skyting_sammendrag: G('skyting', 'Skytesammendrag (totalt · ligg · stå · konkurranse)'),
  skyting_treff_totalt: G('skyting', 'Totalt treff%'),
  skyting_treff_liggende: G('skyting', 'Liggende'),
  skyting_treff_staaende: G('skyting', 'Stående'),
  skyting_treff_konkurranse: G('skyting', 'Konkurranse'),
  skyting_forste_vs_siste: G('skyting', 'Første vs. siste serie'),
  skyting_skuddmaal: G('skyting', 'Skuddmengde mot årsmål', { data: 'selv' }),
  skyting_skuddmengde: G('skyting', 'Skudd per uke / måned', { data: 'selv', config: true }),

  // ── Sammenligning (bolk 5): ØktGraf stablet/oppå + runder + nøkkeltall —
  // favoritt = øktsett + visning (config). Splits per km står som egen graf.
  sammenlign_oktsett: G('sammenlign', 'Sammenligning av økter', { data: 'selv', config: true, bred: true }),
  sammenlign_splits: G('sammenlign', 'Splits per km'),

  // ── Mal-analyse (inne i Sammenligning) ──
  mal_analyse_avg_hr: G('mal_analyse', 'Snittpuls over tid (mal)'),
  mal_analyse_total_time: G('mal_analyse', 'Total tid over tid (mal)'),
  mal_analyse_total_km: G('mal_analyse', 'Total km over tid (mal)'),
  mal_analyse_lactate_progression: G('mal_analyse', 'Laktat-progresjon (mal)'),
  mal_analyse_gjennomforinger: G('mal_analyse', 'Gjennomføringer (mal)'),
  mal_analyse_snittpuls: G('mal_analyse', 'Snittpuls (mal)'),
  mal_analyse_snitt_tid: G('mal_analyse', 'Snitt total tid (mal)'),
  mal_analyse_snitt_km: G('mal_analyse', 'Snitt total km (mal)'),
  mal_analyse_sonefordeling: G('mal_analyse', 'Snitt-sonefordeling (mal)'),

  // ── Årsplan-analyse (inne i Sammenligning) ──
  periodisering_tss_per_period: G('periodisering', 'Sum TSS per periode'),
  periodisering_competitions_per_period: G('periodisering', 'Antall konkurranser per periode'),
  periodisering_sammendrag: G('periodisering', 'Årsplan-sammendrag (perioder · tid · TSS · konkurranser)'),
  periodisering_perioder: G('periodisering', 'Perioder'),
  periodisering_total_tid: G('periodisering', 'Total tid (årsplan)'),
  periodisering_total_tss: G('periodisering', 'Total TSS (årsplan)'),
  periodisering_konkurranser: G('periodisering', 'Konkurranser (årsplan)'),

  // ── Standardøkter (bolk 6): favoritt = serie + variabel; ØktGraf-ene deler komponent med Sammenligning ──
  standardokter_serie: G('standardokter', 'Standardøkt over tid (serie + variabel)', { data: 'selv', config: true }),
  standardokter_tabell: G('standardokter', 'Alle gjennomføringer × alle variabler', { data: 'selv', config: true }),
  standardokter_grafer: G('standardokter', 'Gjennomføringene som ØktGraf (oppå / side om side)', { data: 'selv', config: true }),

  // ── Konkurranser ──
  competitions_placement_over_time: G('konkurranser', 'Plasseringer over tid'),
  competitions_time_per_format: G('konkurranser', 'Sluttid over tid per distanse/format'),
  competitions_shooting_accuracy_over_time: G('konkurranser', 'Treff% per skyting over tid'),
  competitions_shooting_comp_vs_training: G('konkurranser', 'Treff% konkurranse vs trening'),
  competitions_shooting_time_per_series: G('konkurranser', 'Skytetid per serie (konkurranse)'),
  competitions_shooting_hr: G('konkurranser', 'Snittpuls under skyting (konkurranse)'),
  konkurranser_treff_totalt: G('konkurranser', 'Treff% totalt (konkurranse)'),
  konkurranser_treff_liggende: G('konkurranser', 'Treff% liggende (konkurranse)'),
  konkurranser_treff_staaende: G('konkurranser', 'Treff% stående (konkurranse)'),

  // ── Ski-tester ──
  ski_tester_rating_over_time: G('ski_tester', 'Rating over tid'),

  // ── Helse (HelseOversikt henter selv; korrelasjonsgrafene fra getHealthCorrelations) ──
  helse_oversikt: G('helse', 'Helsekortet (hele)'),
  helse_sovnstadier: G('helse', 'Søvnstadier per natt'),
  helse_hrv: G('helse', 'HRV'),
  helse_resting_hr: G('helse', 'Hvilepuls'),
  helse_sovnscore: G('helse', 'Søvnscore'),
  helse_folelse: G('helse', 'Følelse'),
  helse_body_weight: G('helse', 'Vekt'),
  helse_hrv_lang: G('helse', 'Lang trend — HRV'),
  helse_reflections_trend: G('helse', 'Overskudd, stress og opplevd belastning over tid', { data: 'helse_korrelasjon' }),
  helse_injuries_timeline: G('helse', 'Skade-tidslinje', { data: 'helse_korrelasjon' }),
  helse_sickness_vs_load: G('helse', 'Sykdom 🤒 vs månedlig belastning', { data: 'helse_korrelasjon' }),
  // Korrelasjonskortene kommer i bolk 4 — nøklene beholdes så gamle stjerner
  // ikke blir «ukjent graf» (viser «Åpne Helse» til grafen finnes).
  health_recovery_distribution: G('helse', 'Recovery-fordeling'),

  // ── Ernæring ──
  ernering_sammendrag: G('ernering', 'Ernæringssammendrag'),
  ernering_okter: G('ernering', 'Økter med ernæring'),
  ernering_karbo_per_time: G('ernering', 'Snitt karbo/time'),
  ernering_total_karbo: G('ernering', 'Total karbo'),
  ernering_total_protein: G('ernering', 'Total protein'),
  ernering_total_fett: G('ernering', 'Total fett'),
  ernering_total_ketoner: G('ernering', 'Total ketoner'),
  ernering_karbo_vs_varighet: G('ernering', 'Karbo per time vs øktens varighet'),
  ernering_karbo_vs_puls: G('ernering', 'Karbo per time vs snittpuls'),
  ernering_typefordeling: G('ernering', 'Type-fordeling'),

  // ── Vær/føre ──
  vaer_puls_vs_temperatur: G('vaer', 'Snittpuls vs temperatur'),

  // ── Høyde & varme ──
  hoyde_varme_perioder: G('hoyde_varme', 'Høyde- og varmeperioder'),

  // ── Per bevegelsesform ──
  bevegelse_time_and_km: G('per_bevegelsesform', 'Tid og km per uke'),
  bevegelse_avg_hr: G('per_bevegelsesform', 'Snittpuls over tid'),
  bevegelse_zones_per_week: G('per_bevegelsesform', 'Sonefordeling per uke'),
  bevegelse_pace_running: G('per_bevegelsesform', 'Snittempo (løping)'),
  bevegelse_watts: G('per_bevegelsesform', 'Snittwatt over tid'),
  bevegelse_speed_skiing: G('per_bevegelsesform', 'Snitthastighet (langrenn/rulleski)'),
  bevegelse_total_tid: G('per_bevegelsesform', 'Total tid (bev.form)'),
  bevegelse_total_km: G('per_bevegelsesform', 'Total km (bev.form)'),
  bevegelse_aktiviteter: G('per_bevegelsesform', 'Aktiviteter (bev.form)'),
  bevegelse_snittpuls: G('per_bevegelsesform', 'Snittpuls (bev.form)'),
  bevegelse_snittempo: G('per_bevegelsesform', 'Snittempo (bev.form)'),
  bevegelse_snittwatt: G('per_bevegelsesform', 'Snittwatt (bev.form)'),
  // Bolk 7
  bevegelse_kadens: G('per_bevegelsesform', 'Kadens over tid (bev.form)'),
  bevegelse_hoydemeter: G('per_bevegelsesform', 'Høydemeter per uke (bev.form)'),

  // ── Styrke (bolk 9, kun for brukere med styrkeøkter) ──
  styrke_sammendrag: G('styrke', 'Styrke i perioden'),
  styrke_okter: G('styrke', 'Styrkeøkter'),
  styrke_tonnasje: G('styrke', 'Tonnasje'),
  styrke_tid: G('styrke', 'Tid i styrke'),
  styrke_pr_antall: G('styrke', 'PR-er i perioden'),
  styrke_pr_liste: G('styrke', 'Personlige rekorder'),
  styrke_ovelse: G('styrke', 'Øvelse over tid', { config: true }),
  styrke_okter_per_uke: G('styrke', 'Styrkeøkter per uke'),
  styrke_tonnasje_per_uke: G('styrke', 'Tonnasje per uke'),
  styrke_muskelgrupper: G('styrke', 'Fordeling per muskelgruppe'),
  styrke_ovelser_fordeling: G('styrke', 'Mest brukte øvelser'),
  styrke_tid_per_okt: G('styrke', 'Tid per styrkeøkt'),
  styrke_periode_sammenligning: G('styrke', 'Sammenlign to perioder (styrke)'),

  // ── Intensitetsfordeling ──
  intensity_zones_per_week: G('intensitet', 'Sonefordeling per uke'),
  intensity_high_sessions_per_week: G('intensitet', 'Antall økter med I4/I5/Hurtighet per uke'),
  intensity_polarization_per_week: G('intensitet', 'Polarisering per uke'),
  intensitet_total_tid_i_soner: G('intensitet', 'Total tid i soner'),
}

/** Dynamiske nøkkelfamilier: prefiks → fane + tittel fra resten av nøkkelen. */
export const GRAF_FAMILIER: Array<{ prefiks: string; def: (rest: string) => GrafDef }> = [
  { prefiks: 'tester_pr_', def: rest => G('tester_pr', `Utvikling · ${rest.replace(/_/g, ' ')}`) },
  { prefiks: 'test_trend_', def: rest => G('skyting', `Testutvikling · ${rest}`, { data: 'selv' }) },
]

/** Avløste nøkler → arvtaker. Lese-side: en gammel stjerne viser den nye
    grafen; stjerna i grafen eier den nye nøkkelen, og den gamle ryddes
    naturlig når brukeren av-stjerner. Ingen prod-skriving. */
export const NOKKEL_ALIAS: Record<string, string> = {
  klokke_aerob_efficiency: 'prestasjon_ef',
  klokke_watt_per_hr: 'prestasjon_ef',
  klokke_cardiac_drift: 'prestasjon_frakobling',
  'shot-volume': 'skyting_skuddmengde',
  'shot-goal': 'skyting_skuddmaal',
  helse_sleep_hours: 'helse_sovnstadier',
  helse_day_form: 'helse_folelse',
  health_lactate_per_template: 'terskel_laktat_per_mal',
  // Bolk 5: kurvene, laktat og nøkkeltall bor nå i øktsett-sammenligningen (ØktGraf).
  sammenlign_pulskurve: 'sammenlign_oktsett',
  sammenlign_wattkurve: 'sammenlign_oktsett',
  sammenlign_pacekurve: 'sammenlign_oktsett',
  sammenlign_laktat: 'sammenlign_oktsett',
  sammenlign_nokkeltall: 'sammenlign_oktsett',
  // Bolk 6: de tre nakne grafene i Standardøkter er dekket av serie-analysen.
  standardokter_drag_for_drag: 'standardokter_serie',
  standardokter_puls_gjennom_okta: 'standardokter_grafer',
  standardokter_trend_total_tid: 'standardokter_serie',
  // Bolk 4: de gamle scatter-nøklene uten komponent dekkes av korrelasjonskortene.
  helse_stress_vs_load: 'belastning_korrelasjoner',
  helse_energy_vs_load: 'belastning_korrelasjoner',
  helse_rest_vs_perceived: 'belastning_rpe_vs_tss',
}

export function losGrafNokkel(key: string): string {
  return NOKKEL_ALIAS[key] ?? key
}

/** Oppslag med alias og familier. null = ukjent nøkkel. */
export function grafInfo(key: string): GrafDef | null {
  const k = losGrafNokkel(key)
  const g = GRAFER[k]
  if (g) return g
  for (const fam of GRAF_FAMILIER) if (k.startsWith(fam.prefiks) && k.length > fam.prefiks.length) return fam.def(k.slice(fam.prefiks.length))
  return null
}

export function faneForGraf(key: string): FaneKey | null {
  return grafInfo(key)?.fane ?? null
}

/** Datasettet en favoritt trenger — fanens eget når ikke annet er sagt. */
export function dataForGraf(key: string): DataKey | null {
  const g = grafInfo(key)
  if (!g) return null
  if (g.data) return g.data
  return g.fane === 'favoritter' ? null : (g.fane as DataKey)
}

/** Nøkler som gjelder skyting — skjules for ikke-skiskyttere. */
export function erSkyteGraf(key: string): boolean {
  const g = grafInfo(key)
  return !!g && (g.fane === 'skyting' || key.startsWith('competitions_shooting') || key === 'oversikt_skytetreff' || key.startsWith('konkurranser_treff'))
}

# Ikonsettet

Kilde: `design/ikoner/svg` (GPT-eksporten, 14. sep 2026): `ikoner.json` (standard, strek + fyll),
`ikoner-14px.json` (39 forenklede mini-varianter for 14 px), `aliases.json` og SVG-ene rått i `ikoner/`.
`components/ui/ikoner.tsx` genereres fra JSON-ene. Sverres 15 ark (`*.png`) er fasit for form.

Bruk: `<Ikon navn="plan" variant="strek" storrelse={18} />`. Farge = currentColor (arves fra konteksten),
strek 1.7 med runde ender, fyll med nonzero. Størrelser 14 / 18 / 22 / 26; ved 14 velges mini automatisk.

106 definerte paths + 3 alias = 109 navn.

| navn | mini (14 px) | alias for |
|---|---|---|
| a-konkurranse | ja | - |
| abonnement | ja | - |
| advarsel | - | - |
| ai-coach | - | - |
| aktiv-pause | - | - |
| aktivitet | - | - |
| analyse | ja | - |
| angre | - | - |
| annet | - | - |
| apne-fane | - | - |
| arsplan | - | - |
| b-konkurranse | - | - |
| bat | - | - |
| bibliotek | ja | - |
| bokmerke | - | - |
| borse-pa-ryggen | ja | - |
| c-konkurranse | - | - |
| dagbok | ja | - |
| del-her | - | - |
| ernaering | ja | - |
| favoritt | - | - |
| fellestrening | - | - |
| fjern | - | - |
| flytt | - | - |
| for-okt | ja | - |
| forrige | - | - |
| fullfort | - | - |
| gjenta-forrige | - | - |
| hamburgermeny | - | - |
| helse | - | - |
| hjelp | - | - |
| hjem | - | - |
| hoyde | - | - |
| hoydesamling | - | - |
| hviledag | - | - |
| innboks | - | - |
| innstillinger | - | - |
| kadens | ja | - |
| klokke | ja | - |
| koble-flett | - | - |
| konkurranse | ja | - |
| kutt | - | - |
| lagre | - | - |
| laktat | - | - |
| langlop | ja | - |
| langrenn | ja | - |
| las | - | - |
| last-ned | - | - |
| last-opp | - | - |
| legg-til | - | - |
| lengdetest | ja | - |
| live-styrke | - | - |
| logg-ut | - | - |
| lopesko | ja | - |
| loping | - | - |
| lukk | - | - |
| lys | ja | - |
| maleenheter | ja | - |
| maler | ja | - |
| mer | - | - |
| mork | - | - |
| multisport | - | - |
| nedjogg | ja | - |
| neste | - | - |
| oppvarming | - | - |
| parallelltest | ja | - |
| pause | - | - |
| peak | - | favoritt |
| personvern | - | - |
| plan | - | - |
| planlegg | - | - |
| play | - | - |
| profil | - | - |
| puls | - | - |
| reisedag | - | - |
| rulleski | ja | - |
| samling | - | - |
| skade | ja | - |
| ski | ja | - |
| skisko | ja | - |
| skiskyting | ja | - |
| skistaver | ja | - |
| skyting | ja | - |
| sla-sammen | - | - |
| slett | ja | - |
| sok | - | - |
| soner | - | - |
| splitt | - | - |
| standardokt-serie | ja | - |
| styrketrening | - | live-styrke |
| superserie | ja | - |
| sykdom | - | - |
| sykkelsko | ja | - |
| sykling | ja | - |
| synk | - | - |
| tempo | - | - |
| termometer | - | - |
| test | ja | - |
| testlop | ja | - |
| tips | ja | - |
| trener | - | - |
| treningssamling | - | - |
| triatlon | ja | - |
| utstyr | ja | ski |
| varmetrening | ja | - |
| veksling | - | - |
| vekt | - | - |
| vektvest | - | - |
| watt | ja | - |

Aliasene er med vilje (samme motiv): utstyr = ski, styrketrening = live-styrke, peak = favoritt.

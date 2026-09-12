import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, ComposedChart, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceArea, ReferenceLine, Cell
} from 'recharts';
import {
  Activity, AlertCircle, AlertTriangle, ArrowLeft, Bell, Check, CheckCircle2,
  ClipboardList, Droplet, Eye, FileText, Footprints, Gauge, HeartPulse,
  LayoutDashboard, Lock, Pill, Scale, Search, ShieldCheck, Sparkles, Syringe,
  Users, Wifi, WifiOff, X
} from 'lucide-react';

/* ══════════════════════════════════════════════════════════════════
   PALETT  –  4 nøytraler + 3 alvorlighetsfarger + 1 støttefarge.
   Alvorlighetsfargene brukes ALDRI dekorativt andre steder.
   ══════════════════════════════════════════════════════════════════ */
const F = {
  skifer: '#1E293B',   // meny og brødtekst
  lerret: '#E2E8F0',   // kjølig, klinisk bunn
  panel: '#FFFFFF',
  linje: '#CBD5E1',
  normal: '#0369A1',   // rolig blå  – normalt
  moderat: 'hsl(44, 86%, 28%)',  // ravgul     – moderat avvik
  akutt: '#B91C1C',    // rød        – akutt avvik
  enhet: '#0F766E',    // støttefarge: enhets- og etterlevelsesstatus
};

/* Tilstand kodes tre ganger: farge + form + tekst. */
const NIVA = {
  normal: { navn: 'Normalt', hex: F.normal, glyph: '●', bg: 'bg-sky-50', tekst: 'text-sky-900', kant: 'border-sky-700' },
  moderat: { navn: 'Moderat avvik', hex: F.moderat, glyph: '◆', bg: 'bg-amber-50', tekst: 'text-amber-900', kant: 'border-amber-700' },
  akutt: { navn: 'Akutt avvik', hex: F.akutt, glyph: '▲', bg: 'bg-red-50', tekst: 'text-red-900', kant: 'border-red-700' },
};

const INNLOGGET = { navn: 'Sofie Haugen', rolle: 'Sykepleier, hjemmetjenesten' };
const DEMO_DATO = '11.09';
const DEMO_KLOKKE = '09:47';

/* ══════════════════════════════════════════════════════════════════
   HJELPEFUNKSJONER
   ══════════════════════════════════════════════════════════════════ */
const nb = (n, d = 1) =>
  n === null || n === undefined || Number.isNaN(n) ? '–' : Number(n).toFixed(d).replace('.', ',');

function lcg(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function klokke(startMin, i, steg) {
  const m = (startMin + i * steg) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/* Bygger en serie fra nøkkelpunkter med mykt overgangsforløp + støy,
   slik at kurvene får døgnrytme og uro i stedet for ren sinus. */
function serie(kf, n, stoy, seed) {
  const r = lcg(seed);
  const ut = [];
  for (let i = 0; i < n; i++) {
    let j = 0;
    while (j < kf.length - 2 && kf[j + 1][0] < i) j++;
    const [x0, y0] = kf[j];
    const [x1, y1] = kf[j + 1] || kf[j];
    const t = x1 === x0 ? 0 : Math.max(0, Math.min(1, (i - x0) / (x1 - x0)));
    const glatt = t * t * (3 - 2 * t);
    ut.push(y0 + (y1 - y0) * glatt + (r() - 0.5) * 2 * stoy);
  }
  return ut;
}

/* ══════════════════════════════════════════════════════════════════
   SYNTETISKE DATA  –  alle konstanter samlet, enkle å bytte ut
   ══════════════════════════════════════════════════════════════════ */

const DATAKILDER = [
  { id: 'meddispense', navn: 'MedDispense', type: 'Medisindispensere', status: 'tilkoblet', enheter: 312, synk: '09:41' },
  { id: 'nordsensor', navn: 'NordSensor', type: 'Puls, blodtrykk, vekt', status: 'tilkoblet', enheter: 486, synk: '09:45' },
  { id: 'glukolink', navn: 'GlukoLink', type: 'CGM og insulinpumper', status: 'forsinket', enheter: 74, synk: '09:18' },
  { id: 'trygghjem', navn: 'Trygg Hjem', type: 'Dør, bevegelse, fall', status: 'tilkoblet', enheter: 203, synk: '09:44' },
  { id: 'stegvis', navn: 'Stegvis', type: 'Aktivitetsmålere', status: 'nede', enheter: 118, synk: '08:55' },
  { id: 'epj', navn: 'Journal (EPJ)', type: 'Diagnoser, medisinliste, rutiner', status: 'tilkoblet', enheter: 128, synk: '09:46' },
];

const KILDESTATUS = {
  tilkoblet: { navn: 'Tilkoblet', klasse: 'text-teal-300 border-teal-500', glyph: '●' },
  forsinket: { navn: 'Forsinket', klasse: 'text-amber-300 border-amber-500', glyph: '◐' },
  nede: { navn: 'Nede', klasse: 'text-red-300 border-red-500', glyph: '○' },
};

const DISTRIKTER = ['Distrikt Nord', 'Distrikt Sentrum', 'Distrikt Sør', 'Distrikt Vest'];

const PASIENTER = [
  { id: 'ingrid', navn: 'Ingrid Bakke', alder: 84, distrikt: 'Distrikt Nord', adresse: 'Solbakken 14', status: 'moderat', x: 545, y: 70, full: true,
    enheter: ['Medisindispenser', 'Pulsklokke', 'Blodtrykksmåler', 'Fall- og dørsensor'],
    avvik: 'Hvilepuls 96 slag/min natt til fredag', sisteMaling: 'Puls 80 slag/min kl. 09:45', nesteTilsyn: 'I dag kl. 11:00' },
  { id: 'oddmartin', navn: 'Odd Martin Nilsen', alder: 67, distrikt: 'Distrikt Sør', adresse: 'Havneveien 3B', status: 'akutt', x: 440, y: 400, full: true,
    enheter: ['Kontinuerlig glukosemåler', 'Insulinpumpe', 'Vekt', 'Aktivitetsmåler'],
    avvik: 'Glukose 3,1 mmol/L kl. 03:12', sisteMaling: 'Glukose 8,3 mmol/L kl. 09:47', nesteTilsyn: 'I dag kl. 13:30' },
  { id: 'kari', navn: 'Kari Sæther', alder: 79, distrikt: 'Distrikt Sentrum', adresse: 'Kirkegata 22', status: 'moderat', x: 420, y: 255,
    enheter: ['Medisindispenser', 'Blodtrykksmåler'], avvik: 'Systolisk 168 mmHg kl. 07:05', sisteMaling: 'Blodtrykk 168/94 kl. 07:05', nesteTilsyn: 'Mandag kl. 09:00' },
  { id: 'leif', navn: 'Leif Aronsen', alder: 88, distrikt: 'Distrikt Vest', adresse: 'Vestervik 8', status: 'moderat', x: 150, y: 245,
    enheter: ['Medisindispenser', 'Fall- og dørsensor', 'Blodtrykksmåler'], avvik: 'Ingen bevegelse 23:10–05:40', sisteMaling: 'Dørhendelse kl. 05:41', nesteTilsyn: 'I dag kl. 15:00' },
  { id: 'gerd', navn: 'Gerd Olavsen', alder: 91, distrikt: 'Distrikt Nord', adresse: 'Fjellveien 5', status: 'normal', x: 325, y: 38,
    enheter: ['Medisindispenser', 'Vekt'], avvik: null, sisteMaling: 'Vekt 61,2 kg kl. 07:20', nesteTilsyn: 'Lørdag kl. 10:00' },
  { id: 'hakon', navn: 'Håkon Vik', alder: 73, distrikt: 'Distrikt Sentrum', adresse: 'Møllergata 7', status: 'normal', x: 545, y: 225,
    enheter: ['Pulsklokke'], avvik: null, sisteMaling: 'Puls 71 slag/min kl. 09:40', nesteTilsyn: 'Tirsdag kl. 12:00' },
  { id: 'marit', navn: 'Marit Sundvor', alder: 81, distrikt: 'Distrikt Sør', adresse: 'Strandlinjen 19', status: 'normal', x: 330, y: 385,
    enheter: ['Medisindispenser', 'Fall- og dørsensor'], avvik: null, sisteMaling: 'Dose dispensert kl. 08:05', nesteTilsyn: 'I dag kl. 16:00' },
  { id: 'trygve', navn: 'Trygve Lind', alder: 69, distrikt: 'Distrikt Vest', adresse: 'Bergsvingen 2', status: 'normal', x: 95, y: 207,
    enheter: ['Blodtrykksmåler', 'Aktivitetsmåler'], avvik: null, sisteMaling: 'Blodtrykk 128/78 kl. 08:10', nesteTilsyn: 'Onsdag kl. 11:30' },
  { id: 'astrid', navn: 'Astrid Nervik', alder: 86, distrikt: 'Distrikt Nord', adresse: 'Lundeveien 31', status: 'normal', x: 655, y: 120,
    enheter: ['Medisindispenser', 'Pulsklokke', 'Fall- og dørsensor'], avvik: null, sisteMaling: 'Puls 74 slag/min kl. 09:30', nesteTilsyn: 'I dag kl. 14:00' },
  { id: 'bjarne', navn: 'Bjarne Rustad', alder: 77, distrikt: 'Distrikt Sentrum', adresse: 'Torget 4', status: 'normal', x: 470, y: 195,
    enheter: ['Vekt', 'Aktivitetsmåler'], avvik: null, sisteMaling: 'Vekt 88,4 kg kl. 06:55', nesteTilsyn: 'Torsdag kl. 10:30' },
  { id: 'solveig', navn: 'Solveig Hauan', alder: 83, distrikt: 'Distrikt Sør', adresse: 'Sjøgata 12', status: 'normal', x: 600, y: 415,
    enheter: ['Medisindispenser', 'Blodtrykksmåler'], avvik: null, sisteMaling: 'Blodtrykk 134/82 kl. 08:20', nesteTilsyn: 'Fredag kl. 09:30' },
  { id: 'reidar', navn: 'Reidar Tveit', alder: 90, distrikt: 'Distrikt Vest', adresse: 'Nausthaugen 6', status: 'normal', x: 205, y: 305,
    enheter: ['Fall- og dørsensor'], avvik: null, sisteMaling: 'Dørhendelse kl. 09:12', nesteTilsyn: 'I dag kl. 12:30' },
  { id: 'liv', navn: 'Liv Bergesen', alder: 75, distrikt: 'Distrikt Nord', adresse: 'Bjørkelia 9', status: 'normal', x: 400, y: 45,
    enheter: ['Pulsklokke', 'Aktivitetsmåler'], avvik: null, sisteMaling: 'Puls 68 slag/min kl. 09:35', nesteTilsyn: 'Mandag kl. 13:00' },
  { id: 'perkristian', navn: 'Per Kristian Moe', alder: 71, distrikt: 'Distrikt Sentrum', adresse: 'Parkveien 27', status: 'normal', x: 640, y: 280,
    enheter: ['Medisindispenser', 'Vekt'], avvik: null, sisteMaling: 'Dose dispensert kl. 08:02', nesteTilsyn: 'Onsdag kl. 15:30' },
];

const pasient = (id) => PASIENTER.find((p) => p.id === id);

const VARSLER = [
  { id: 'v1', dato: '11.09', tid: '07:05', niva: 'moderat', pid: 'kari', kilde: 'Blodtrykksmåler NS-2 · NordSensor',
    hva: 'Systolisk 168 mmHg – 22 over øvre grense (146) ved morgenmåling' },
  { id: 'v2', dato: '11.09', tid: '05:40', niva: 'moderat', pid: 'leif', kilde: 'Dørsensor TH-1 · Trygg Hjem',
    hva: 'Ingen bevegelse registrert 23:10–05:40 – vanlig mønster er 2–3 nattlige dørhendelser' },
  { id: 'v3', dato: '11.09', tid: '03:12', niva: 'akutt', pid: 'oddmartin', kilde: 'CGM G6-Nord · GlukoLink', flagg: 'om1',
    hva: 'Glukose 3,1 mmol/L – fall på 2,4 mmol/L siste 70 min, under nedre grense 4,0' },
  { id: 'v4', dato: '11.09', tid: '02:48', niva: 'moderat', pid: 'oddmartin', kilde: 'Insulinpumpe P-400 · GlukoLink',
    hva: 'Reservoar 12 % – rekker om lag 14 timer med gjeldende basaldose' },
  { id: 'v5', dato: '11.09', tid: '01:15', niva: 'moderat', pid: 'ingrid', kilde: 'Pulsklokke NS-4 · NordSensor', flagg: 'in3',
    hva: 'Hvilepuls 96 slag/min – 22 over øvre grense for eget nattsnitt (74)' },
  { id: 'v6', dato: '10.09', tid: '21:35', niva: 'moderat', pid: 'ingrid', kilde: 'Dispenser MD-7 · MedDispense', flagg: 'in2',
    hva: 'Kveldsdose registrert 95 minutter etter planlagt tid kl. 20:00' },
  { id: 'v7', dato: '10.09', tid: '15:32', niva: 'moderat', pid: 'oddmartin', kilde: 'CGM G6-Nord · GlukoLink', flagg: 'om2',
    hva: 'Glukose 12,4 mmol/L – 4,4 over øvre grense, endring +4,6 på 90 min' },
  { id: 'v8', dato: '08.09', tid: '20:45', niva: 'moderat', pid: 'ingrid', kilde: 'Dispenser MD-7 · MedDispense', flagg: 'in1',
    hva: 'Kveldsdose ikke dispensert innen 45 minutter etter planlagt tid' },
  { id: 'v9', dato: '08.09', tid: '11:30', niva: 'moderat', pid: 'gerd', kilde: 'Vekt NS-9 · NordSensor',
    hva: 'Vekt 61,2 kg – ned 2,4 kg på 14 dager', kvittertAv: 'Tone Ødegård', kvittertTid: '08.09 kl. 12:04' },
];

const AVVIK_PER_DISTRIKT = [
  { distrikt: 'Nord', moderat: 12, akutt: 2 },
  { distrikt: 'Sentrum', moderat: 8, akutt: 1 },
  { distrikt: 'Sør', moderat: 13, akutt: 4 },
  { distrikt: 'Vest', moderat: 5, akutt: 1 },
];

const ETTERLEVELSE_UKE = [
  { dag: 'lør 05.09', tatt: 94, forsinket: 4, ikke: 2 },
  { dag: 'søn 06.09', tatt: 92, forsinket: 5, ikke: 3 },
  { dag: 'man 07.09', tatt: 96, forsinket: 3, ikke: 1 },
  { dag: 'tir 08.09', tatt: 89, forsinket: 7, ikke: 4 },
  { dag: 'ons 09.09', tatt: 93, forsinket: 5, ikke: 2 },
  { dag: 'tor 10.09', tatt: 88, forsinket: 9, ikke: 3 },
  { dag: 'fre 11.09', tatt: 91, forsinket: 6, ikke: 3 },
];

const VARSELVOLUM = [
  ['29.08', 6, 0], ['30.08', 8, 1], ['31.08', 5, 0], ['01.09', 9, 0], ['02.09', 7, 1],
  ['03.09', 6, 0], ['04.09', 11, 2], ['05.09', 8, 0], ['06.09', 7, 1], ['07.09', 9, 0],
  ['08.09', 12, 1], ['09.09', 10, 2], ['10.09', 13, 1], ['11.09', 8, 1],
].map(([dato, moderat, akutt]) => ({ dato, moderat, akutt }));

/* ─── Pasient A: Ingrid Bakke ───────────────────────────────────── */

/* Puls: 15-minutters kadens fra torsdag kl. 10:00 til fredag kl. 09:45 */
const PULS_START = 600, PULS_STEG = 15, PULS_N = 96;
const pulsRaa = serie(
  [[0, 78], [8, 84], [16, 80], [24, 86], [32, 82], [40, 76], [44, 72], [48, 68],
   [50, 70], [54, 84], [58, 92], [61, 96], [64, 94], [68, 84], [72, 70], [80, 64], [88, 76], [95, 80]],
  PULS_N, 2.6, 11
);
const PULS_24T = Array.from({ length: PULS_N }, (_, i) => {
  const t = klokke(PULS_START, i, PULS_STEG);
  let v = Math.round(pulsRaa[i]);
  if (t === '01:15') v = 96;
  return { t, v, dag: i < 56 ? '10.09' : '11.09' };
});
const PULS_VINDU = { fra: '22:30', til: '03:00' };

const HVILEPULS_7D = [
  { dato: '05.09', v: 63 }, { dato: '06.09', v: 65 }, { dato: '07.09', v: 62 },
  { dato: '08.09', v: 67 }, { dato: '09.09', v: 70 }, { dato: '10.09', v: 72 }, { dato: '11.09', v: 88 },
];

/* Medisinering: 7-dagers rutenett, to doser per dag */
const MEDISIN_7D = [
  { dato: '05.09', dag: 'lør', morgen: { tid: '08:04', status: 'tatt' }, kveld: { tid: '20:06', status: 'tatt' } },
  { dato: '06.09', dag: 'søn', morgen: { tid: '08:02', status: 'tatt' }, kveld: { tid: '20:03', status: 'tatt' } },
  { dato: '07.09', dag: 'man', morgen: { tid: '08:11', status: 'tatt' }, kveld: { tid: '20:12', status: 'tatt' } },
  { dato: '08.09', dag: 'tir', morgen: { tid: '08:06', status: 'tatt' }, kveld: { tid: null, status: 'ikke' } },
  { dato: '09.09', dag: 'ons', morgen: { tid: '08:03', status: 'tatt' }, kveld: { tid: '20:08', status: 'tatt' } },
  { dato: '10.09', dag: 'tor', morgen: { tid: '08:09', status: 'tatt' }, kveld: { tid: '21:35', status: 'forsinket' } },
  { dato: '11.09', dag: 'fre', morgen: { tid: '08:07', status: 'tatt' }, kveld: { tid: null, status: 'planlagt' } },
];
const DOSESTATUS = {
  tatt: { navn: 'Tatt', hex: F.enhet, klasse: 'bg-teal-50 border-teal-700 text-teal-900', glyph: '✓' },
  forsinket: { navn: 'Forsinket', hex: F.moderat, klasse: 'bg-amber-50 border-amber-700 text-amber-900', glyph: '◆' },
  ikke: { navn: 'Ikke tatt', hex: F.akutt, klasse: 'bg-red-50 border-red-700 text-red-900', glyph: '✕' },
  planlagt: { navn: 'Planlagt', hex: '#64748B', klasse: 'bg-slate-50 border-slate-400 text-slate-600', glyph: '·' },
};

/* Blodtrykk: 14 dager, morgen- og kveldsmåling */
const BT_DATOER = ['28.08', '29.08', '30.08', '31.08', '01.09', '02.09', '03.09', '04.09', '05.09', '06.09', '07.09', '08.09', '09.09', '10.09'];
const BT_KVELD_SYS = [138, 137, 141, 139, 143, 140, 144, 146, 148, 147, 152, 155, 158, 161];
const BT_KVELD_DIA = [82, 81, 84, 83, 85, 84, 86, 87, 88, 88, 90, 91, 92, 93];
const BT_MORGEN_SYS = [132, 130, 134, 133, 131, 135, 132, 134, 130, 133, 135, 132, 134, 133];
const BLODTRYKK_14D = BT_DATOER.map((dato, i) => ({
  dato, kveldSys: BT_KVELD_SYS[i], kveldDia: BT_KVELD_DIA[i], morgenSys: BT_MORGEN_SYS[i],
}));
const BT_VINDU = { fra: '05.09', til: '10.09' };

/* Aktivitet og fall: 14 dager */
const AKTIVITET_14D = BT_DATOER.map((dato, i) => ({
  dato,
  dorapninger: [7, 6, 8, 6, 7, 5, 6, 4, 5, 4, 3, 4, 2, 3][i],
  bevegelser: [42, 38, 45, 40, 44, 33, 36, 29, 31, 27, 22, 25, 19, 21][i],
}));

const JOURNAL_INGRID = {
  diagnoser: ['Hjertesvikt NYHA II', 'Hypertensjon', 'Artrose i venstre hofte'],
  medisiner: ['Furosemid 20 mg – morgen kl. 08:00', 'Metoprolol 25 mg – kveld kl. 20:00', 'Paracet 500 mg – ved behov'],
  rutiner: [
    'Kveldsdose kl. 20:00, dispenseres automatisk.',
    'Tilsyn tirsdag og fredag kl. 11:00.',
    'Blodtrykk måles morgen og kveld.',
    'Kontakt fastlege ved gjentatte systoliske målinger over 160.',
  ],
  parorende: 'Datter, Anne Bakke – kontaktes ved akutte hendelser.',
};

/* ─── Pasient B: Odd Martin Nilsen ──────────────────────────────── */

/* Glukose: CGM med 5-minutters kadens fra torsdag kl. 12:02 */
const GLUK_START = 722, GLUK_STEG = 5, GLUK_N = 262;
const glukRaa = serie(
  [[0, 7.0], [12, 6.5], [24, 7.8], [30, 8.6], [36, 9.9], [42, 12.4], [48, 12.6], [54, 11.4],
   [66, 9.2], [72, 8.4], [78, 10.6], [90, 8.8], [102, 7.4], [114, 6.6], [122, 6.4], [134, 6.0],
   [146, 5.6], [158, 5.3], [168, 5.5], [176, 4.6], [182, 3.1], [188, 3.6], [194, 4.8], [200, 5.6],
   [212, 5.9], [224, 6.1], [236, 6.4], [242, 7.2], [248, 9.6], [254, 9.1], [261, 8.3]],
  GLUK_N, 0.13, 23
);
const GLUKOSE_24T = Array.from({ length: GLUK_N }, (_, i) => {
  const t = klokke(GLUK_START, i, GLUK_STEG);
  let v = Math.round(glukRaa[i] * 10) / 10;
  if (i >= 110 && i <= 120) v = null;          // sensoren uten kontakt 21:12–22:07
  if (t === '02:02') v = 5.5;          // referansepunktet flagget måler endringen fra
  if (t === '15:32') v = 12.4;
  if (t === '03:12') v = 3.1;
  return { t, v, dag: i < 144 ? '10.09' : '11.09' };
});
const GLUK_MAL = { min: 4.0, max: 8.0 };
const GLUK_VINDU = { fra: '02:02', til: '04:32' };

const TID_I_MALOMRADE = { i: 61, over: 32, under: 7 };
const TIR_14D = BT_DATOER.map((dato, i) => ({
  dato, v: [74, 73, 75, 72, 71, 70, 69, 68, 67, 66, 65, 64, 62, 61][i],
}));

/* Insulin: basal per time + registrerte boluser */
const INSULIN_BASAL = Array.from({ length: 24 }, (_, h) => ({
  time: `${String(h).padStart(2, '0')}:00`,
  basal: h >= 23 || h < 6 ? 0.85 : 1.10,
  bolus: { 8: 5, 12: 4, 15: 6, 18: 6, 22: 2 }[h] || 0,
}));
const BOLUSER = [
  { tid: '08:10', dose: 5, merknad: 'Frokost' },
  { tid: '12:20', dose: 4, merknad: 'Lunsj' },
  { tid: '15:48', dose: 6, merknad: 'Registrert 48 min etter måltid kl. 15:00' },
  { tid: '18:05', dose: 6, merknad: 'Kveldsmåltid' },
  { tid: '22:00', dose: 2, merknad: 'Korreksjon' },
];
const PUMPESTATUS = { tilstand: 'Aktiv', reservoar: 12, rekkerTil: 'ca. kl. 17:00 i dag', sisteOkklusjon: 'Ingen registrert siste 30 dager' };

const VEKT_30D = (() => {
  const r = lcg(5);
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date(2026, 7, 13 + i);
    return {
      dato: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      v: Math.round((94.2 - (i / 29) * 2.4 + (r() - 0.5) * 0.5) * 10) / 10,
    };
  });
})();

const SKRITT_14D = BT_DATOER.map((dato, i) => ({
  dato, v: [4200, 3900, 4600, 5100, 3800, 2900, 3300, 4100, 4400, 3600, 2700, 2400, 2100, 1800][i],
}));

const JOURNAL_ODD = {
  diagnoser: ['Diabetes type 1 (siden 1994)', 'Diabetisk nevropati i føtter', 'Overvekt'],
  medisiner: ['Insulinpumpe – basal 0,85 E/t kl. 23:00–06:00, 1,10 E/t på dag', 'Bolus etter måltid, 4–6 E', 'Atorvastatin 20 mg – kveld'],
  rutiner: [
    'Måltid kl. 15:00, bolus 6 E.',
    'Kveldsmåltid kl. 18:00, bolus 6 E.',
    'Vekt måles hver mandag morgen.',
    'Tilsyn mandag og torsdag kl. 13:30.',
  ],
  parorende: 'Samboer, Bente Aas – bor i samme husstand.',
};

const PROFIL = {
  ingrid: {
    oppdatert: '09.09 kl. 11:40', kilde: 'Journalnotater, tilsynsrapporter og registreringer fra enhetene',
    vaner: [
      'Står opp mellom kl. 07:00 og 07:30. Dørsensoren viser en fast tur til postkassen rundt kl. 09:15.',
      'Tar kveldsdosen mens hun ser nyhetene kl. 20:00, og legger seg mellom kl. 22:00 og 22:30.',
      'Handler selv på onsdager. Er sjelden ute etter kl. 16:00.',
      'Drikker lite utover dagen – kaffe om morgenen, te til kvelds.',
    ],
    rutiner: [
      'Tilsyn tirsdag og fredag kl. 11:00.',
      'Blodtrykk morgen og kveld, hun måler selv.',
      'Dispenseren fylles av hjemmetjenesten hver mandag.',
      'Datteren Anne kommer på søndager og handler.',
    ],
    viktig: [
      'Nedsatt hørsel på venstre øre. Snakk fra høyre side.',
      'Bruker rullator innendørs etter hofteoperasjonen. Terskelen til badet er løs.',
      'Nøkkelboks til høyre for inngangsdøren, kode ligger i journalen.',
      'Katten Milla må ikke ut – lukk kjøkkendøren før du går.',
      'Vil ikke ha besøk før kl. 09:00. Ring på to ganger, hun bruker tid til døren.',
    ],
  },
  oddmartin: {
    oppdatert: '10.09 kl. 14:05', kilde: 'Journalnotater, tilsynsrapporter og registreringer fra enhetene',
    vaner: [
      'Står opp kl. 06:30 og går en fast tur langs kaien før frokost. Turen har blitt kortere den siste uken.',
      'Spiser middag kl. 15:00 og kveldsmat kl. 18:00. Bolusen registreres ofte etter måltidet, ikke før.',
      'Ser fotball sent i helgene og sover lenger på søndager.',
      'Fører ikke måltidsdagbok.',
    ],
    rutiner: [
      'Tilsyn mandag og torsdag kl. 13:30.',
      'Vekt måles hver mandag morgen.',
      'Glukosesensoren byttes hver tiende dag. Neste bytte 14.09.',
      'Samboeren Bente er hjemme på dagtid, borte tirsdag og torsdag ettermiddag.',
    ],
    viktig: [
      'Nevropati i føttene. Fotinspeksjon ved hvert tilsyn – han kjenner ikke sår selv.',
      'Merker føling dårlig om natten. Druejuice står i kjøleskapsdøren.',
      'Pumpen sitter på venstre side av magen, sensoren på venstre overarm.',
      'Trappen opp til inngangsdøren mangler rekkverk på høyre side.',
      'Vil ha SMS før tilsyn.',
    ],
  },
};

const SENSORDEKNING = {
  ingrid: { dekning: 72, anbefalt: 2, planlagt: 3, grunnlag: '4 enheter, sammenhengende data siste 30 dager i 96 % av tiden' },
  oddmartin: { dekning: 84, anbefalt: 1, planlagt: 2, grunnlag: '4 enheter, kontinuerlig glukosemåling i 91 % av tiden', laast: 'Gjeldende frekvens holdes så lenge det ligger et akutt avvik på pasienten.' },
};

/* ─── Flagg: hvert flagg bærer selve dataene det bygger på ──────── */

function utsnitt(data, fra, til) {
  const a = data.findIndex((d) => d.t === fra);
  const b = data.findIndex((d) => d.t === til);
  return a < 0 || b < 0 ? [] : data.slice(a, b + 1);
}

const gluk1 = utsnitt(GLUKOSE_24T, '02:02', '04:32');
const gluk2 = utsnitt(GLUKOSE_24T, '13:32', '16:32');
const puls1 = utsnitt(PULS_24T, '21:30', '03:30');

const MODULNAVN = {
  puls: 'Puls', medisin: 'Medisinering', blodtrykk: 'Blodtrykk', aktivitet: 'Aktivitet og fall',
  glukose: 'Glukose', insulin: 'Insulin', vekt: 'Vekt', skritt: 'Aktivitet',
};

const PASIENT_MODULER = {
  ingrid: ['puls', 'medisin', 'blodtrykk', 'aktivitet'],
  oddmartin: ['glukose', 'insulin', 'vekt', 'skritt'],
};

const FLAGG = [
  {
    id: 'in1', pid: 'ingrid', dato: '08.09', tid: '20:45', niva: 'moderat', modul: 'medisin',
    tittel: 'Kveldsdose tirsdag ikke registrert',
    kilde: 'Dispenser MD-7 · MedDispense',
    verdi: { hoved: '0 av 1 dose uttatt', referanse: 'planlagt kl. 20:00', avvik: 'ingen registrering innen 45 min (grense 30 min)', endring: 'første uteblitte dose på 21 dager' },
    minigraf: {
      type: 'stolpe', enhet: 'min etter planlagt tid', desimaler: 0, domain: [0, 110], grense: 30,
      data: [{ t: '05.09', v: 6 }, { t: '06.09', v: 3 }, { t: '07.09', v: 12 }, { t: '08.09', v: null },
             { t: '09.09', v: 8 }, { t: '10.09', v: 95 }, { t: '11.09', v: null }],
      avvikPunkter: ['08.09', '10.09'], xTittel: 'Kveldsdose, minutter etter planlagt tid · 08.09 mangler registrering og gir ingen søyle · 11.09 er ikke forfalt',
    },
    raadata: {
      kolonner: ['Dato', 'Dose', 'Planlagt', 'Registrert', 'Avvik'],
      rader: MEDISIN_7D.map((d) => [
        `${d.dag} ${d.dato}`, 'Metoprolol 25 mg', 'kl. 20:00',
        d.kveld.tid ? `kl. ${d.kveld.tid}` : (d.kveld.status === 'planlagt' ? 'ikke forfalt' : 'ingen registrering'),
        d.kveld.status === 'ikke' ? 'dose uteblitt' : d.kveld.tid ? `+${(parseInt(d.kveld.tid.slice(0, 2)) * 60 + parseInt(d.kveld.tid.slice(3))) - 1200} min` : '–',
      ]),
      avvikRader: [3, 5],
    },
    journallinje: 'Rutine: kveldsdose metoprolol 25 mg kl. 20:00, dispenseres automatisk. Tilsyn tirsdag og fredag kl. 11:00.',
    handling: 'Tirsdag kl. 20:45 – moderat avvik i medisinering. Se gjennom dispenserloggen for 08.09 og spør pasienten ved neste tilsyn om dosen ble tatt manuelt utenom dispenseren.',
    vindu: { modul: 'medisin', celle: '08.09' },
  },
  {
    id: 'in2', pid: 'ingrid', dato: '10.09', tid: '21:35', niva: 'moderat', modul: 'medisin',
    tittel: 'Kveldsdose torsdag registrert 95 minutter for sent',
    kilde: 'Dispenser MD-7 · MedDispense',
    verdi: { hoved: 'Registrert kl. 21:35', referanse: 'planlagt kl. 20:00', avvik: '+95 min (grense 30 min)', endring: 'lengste forsinkelse i perioden' },
    minigraf: {
      type: 'stolpe', enhet: 'min etter planlagt tid', desimaler: 0, domain: [0, 110], grense: 30,
      data: [{ t: '05.09', v: 6 }, { t: '06.09', v: 3 }, { t: '07.09', v: 12 }, { t: '08.09', v: null },
             { t: '09.09', v: 8 }, { t: '10.09', v: 95 }, { t: '11.09', v: null }],
      avvikPunkter: ['10.09'], xTittel: 'Kveldsdose, minutter etter planlagt tid · 08.09 mangler registrering og gir ingen søyle · 11.09 er ikke forfalt',
    },
    raadata: {
      kolonner: ['Dato', 'Dose', 'Planlagt', 'Registrert', 'Avvik'],
      rader: MEDISIN_7D.map((d) => [
        `${d.dag} ${d.dato}`, 'Metoprolol 25 mg', 'kl. 20:00',
        d.kveld.tid ? `kl. ${d.kveld.tid}` : (d.kveld.status === 'planlagt' ? 'ikke forfalt' : 'ingen registrering'),
        d.kveld.status === 'ikke' ? 'dose uteblitt' : d.kveld.tid ? `+${(parseInt(d.kveld.tid.slice(0, 2)) * 60 + parseInt(d.kveld.tid.slice(3))) - 1200} min` : '–',
      ]),
      avvikRader: [5],
    },
    journallinje: 'Rutine: kveldsdose metoprolol 25 mg kl. 20:00, dispenseres automatisk.',
    handling: 'Torsdag kl. 21:35 – moderat avvik i medisinering. Se dosen i sammenheng med pulsmålingene natt til fredag, og ta opp kveldsrutinen ved neste tilsyn.',
    vindu: { modul: 'medisin', celle: '10.09' },
  },
  {
    id: 'in3', pid: 'ingrid', dato: '11.09', tid: '01:15', niva: 'moderat', modul: 'puls',
    tittel: 'Forhøyet hvilepuls natt til fredag',
    kilde: 'Pulsklokke NS-4 · NordSensor',
    verdi: { hoved: '96 slag/min', referanse: 'eget nattsnitt 66 (58–74)', avvik: '+22 over øvre grense', endring: 'endring +26 på 2 t 45 min' },
    minigraf: {
      type: 'linje', enhet: 'slag/min', desimaler: 0, domain: [55, 105], band: { min: 58, max: 74 },
      data: puls1.map((d) => ({ t: d.t, v: d.v })), avvikPunkter: ['01:15'], xTittel: 'Puls 21:30–03:30, avviksvinduet er 22:30–03:00',
    },
    raadata: {
      kolonner: ['Tidspunkt', 'Puls (slag/min)'],
      rader: puls1.map((d) => [`${d.dag} kl. ${d.t}`, String(d.v)]),
      avvikRader: puls1.map((d, i) => (d.v > 74 ? i : -1)).filter((i) => i >= 0),
    },
    journallinje: 'Diagnose: hjertesvikt NYHA II. Fast medisin: metoprolol 25 mg kveld kl. 20:00 (frekvensdempende).',
    handling: 'Natt til fredag kl. 01:15 – moderat avvik i hvilepuls. Se gjennom måledata i perioden 22:30–03:00, og se den i sammenheng med at kveldsdosen torsdag ble registrert 95 minutter for sent. Spør pasienten om søvn og uro ved neste tilsyn.',
    vindu: { modul: 'puls', fra: '22:30', til: '03:00' },
  },
  {
    id: 'in4', pid: 'ingrid', dato: '10.09', tid: '21:50', niva: 'moderat', modul: 'blodtrykk', utenVarsel: true,
    tittel: 'Kveldsblodtrykket har steget jevnt i 14 dager',
    kilde: 'Blodtrykksmåler NS-2 · NordSensor',
    verdi: { hoved: '161 mmHg systolisk (kveld 10.09)', referanse: 'mål under 140/90', avvik: '+21 over målgrense', endring: 'endring +23 mmHg på 14 dager' },
    minigraf: {
      type: 'linje', enhet: 'mmHg', desimaler: 0, domain: [120, 170], band: { min: 0, max: 140 },
      data: BLODTRYKK_14D.map((d) => ({ t: d.dato, v: d.kveldSys })),
      avvikPunkter: ['07.09', '08.09', '09.09', '10.09'], xTittel: 'Systolisk kveldsmåling, 14 dager',
    },
    raadata: {
      kolonner: ['Dato', 'Kveld systolisk', 'Kveld diastolisk', 'Morgen systolisk'],
      rader: BLODTRYKK_14D.slice(7).map((d) => [`${d.dato} kl. 21:50`, `${d.kveldSys} mmHg`, `${d.kveldDia} mmHg`, `${d.morgenSys} mmHg`]),
      avvikRader: [3, 4, 5, 6],
    },
    journallinje: 'Rutine: blodtrykk måles morgen og kveld. Kontakt fastlege ved gjentatte systoliske målinger over 160.',
    handling: 'Mønster siste 14 dager – ingen enkeltmåling var høy nok til å utløse varsel. Se gjennom kveldsmålingene fra 28.08 til 10.09 i blodtrykksmodulen; morgenmålingene er uendret i samme periode. Ta opp måletidspunkt og kveldsrutiner ved neste tilsyn, og vurder journalens rutine for kontakt med fastlege.',
    vindu: { modul: 'blodtrykk', fra: '05.09', til: '10.09' },
  },
  {
    id: 'om2', pid: 'oddmartin', dato: '10.09', tid: '15:32', niva: 'moderat', modul: 'glukose',
    tittel: 'Glukose over øvre grense etter ettermiddagsmåltid',
    kilde: 'CGM G6-Nord · GlukoLink',
    verdi: { hoved: '12,4 mmol/L', referanse: 'målområde 4,0–8,0 mmol/L', avvik: '+4,4 over øvre grense', endring: 'endring +4,6 på 90 min' },
    minigraf: {
      type: 'linje', enhet: 'mmol/L', desimaler: 1, domain: [4, 14], band: { min: 4, max: 8 },
      data: gluk2.map((d) => ({ t: d.t, v: d.v })), avvikPunkter: ['15:32'], xTittel: 'Glukose 13:32–16:32',
    },
    raadata: {
      kolonner: ['Tidspunkt', 'Glukose (mmol/L)'],
      rader: gluk2.map((d) => [`${d.dag} kl. ${d.t}`, nb(d.v, 1)]),
      avvikRader: gluk2.map((d, i) => (d.v > 8 ? i : -1)).filter((i) => i >= 0),
    },
    journallinje: 'Rutine: måltid kl. 15:00, bolus 6 E. Bolus for dette måltidet er registrert kl. 15:48.',
    handling: 'Torsdag kl. 15:32 – moderat avvik i glukose. Se gjennom måledata i perioden 15:00–16:30 og spør pasienten om måltidsrutiner ved neste tilsyn dersom det er grunn til bekymring.',
    vindu: { modul: 'glukose', fra: '14:02', til: '16:32' },
  },
  {
    id: 'om1', pid: 'oddmartin', dato: '11.09', tid: '03:12', niva: 'akutt', modul: 'glukose',
    tittel: 'Akutt fall i glukose natt til fredag',
    kilde: 'CGM G6-Nord · GlukoLink',
    verdi: { hoved: '3,1 mmol/L', referanse: 'målområde 4,0–8,0 mmol/L', avvik: '−0,9 under nedre grense', endring: 'endring −2,4 på 70 min' },
    minigraf: {
      type: 'linje', enhet: 'mmol/L', desimaler: 1, domain: [2.5, 7], band: { min: 4, max: 8 },
      data: gluk1.map((d) => ({ t: d.t, v: d.v })), avvikPunkter: ['03:12'], xTittel: 'Glukose 02:02–04:32',
    },
    raadata: {
      kolonner: ['Tidspunkt', 'Glukose (mmol/L)'],
      rader: gluk1.map((d) => [`${d.dag} kl. ${d.t}`, nb(d.v, 1)]),
      avvikRader: gluk1.map((d, i) => (d.v < 4 ? i : -1)).filter((i) => i >= 0),
    },
    journallinje: 'Rutine: kveldsmåltid kl. 18:00, bolus 6 E. Basal 0,85 E/t kl. 23:00–06:00.',
    handling: 'Fredag kl. 03:12 – akutt avvik i glukose. Se gjennom måledata i perioden 02:00–04:30, og se hvordan basaldosen for natt i journalen ligger i forhold til forløpet. Spør pasienten om kveldsmåltid, aktivitet på ettermiddagen og om hendelsen ble oppdaget i natt.',
    vindu: { modul: 'glukose', fra: '02:02', til: '04:32' },
  },
  {
    id: 'om3', pid: 'oddmartin', dato: '11.09', tid: '06:00', niva: 'moderat', modul: 'glukose', utenVarsel: true,
    tittel: 'Tid i målområde faller over 14 dager',
    kilde: 'CGM G6-Nord · GlukoLink',
    verdi: { hoved: '61 % i målområde', referanse: 'mål 70 % eller mer', avvik: '−9 prosentpoeng under mål', endring: 'endring −13 prosentpoeng på 14 dager' },
    minigraf: {
      type: 'linje', enhet: '%', desimaler: 0, domain: [55, 80], band: { min: 70, max: 100 },
      data: TIR_14D.map((d) => ({ t: d.dato, v: d.v })), avvikPunkter: ['08.09', '09.09', '10.09'], xTittel: 'Tid i målområde per døgn, 14 dager',
    },
    raadata: {
      kolonner: ['Dato', 'I målområde', 'Over 8,0', 'Under 4,0'],
      rader: TIR_14D.slice(7).map((d, i) => [d.dato, `${d.v} %`, `${[26, 27, 28, 29, 30, 32, 32][i]} %`, `${[6, 6, 6, 6, 5, 6, 7][i]} %`]),
      avvikRader: [4, 5, 6],
    },
    journallinje: 'Rutine: måltid kl. 15:00 og kveldsmåltid kl. 18:00, bolus 6 E. Tilsyn mandag og torsdag kl. 13:30.',
    handling: 'Mønster siste 14 dager – ingen enkeltmåling utløste varsel. Se gjennom døgnkurvene for 04.09–10.09 og hvordan bolustidspunktene ligger i forhold til måltidene i journalen.',
    vindu: { modul: 'glukose', fra: '13:32', til: '16:32' },
  },
];

const flaggFor = (pid) => FLAGG.filter((f) => f.pid === pid);
const flagg = (id) => FLAGG.find((f) => f.id === id);

const RAPPORT = {
  ingrid: {
    sammendrag: [
      'Uken har to hendelser i medisineringen og én natt med forhøyet hvilepuls. Kveldsdosen tirsdag 08.09 ble ikke registrert av dispenseren, og torsdag 10.09 ble den registrert kl. 21:35 – 95 minutter etter tidspunktet journalen oppgir.',
      'Natt til fredag lå hvilepulsen over øvre grense for pasientens eget nattsnitt i om lag fire og en halv time, med 96 slag/min som høyeste måling. Hendelsene ligger tett i tid. Systemet slår ikke fast noen sammenheng, men peker på at de bør ses under ett.',
      'Kveldsmålingene av blodtrykk har steget jevnt gjennom hele 14-dagersperioden, uten at noen enkeltmåling var høy nok til å utløse varsel. Morgenmålingene i samme periode er uendret. Dørsensoren viser færre hendelser de siste fem dagene enn de ni foregående; ingen fall er registrert.',
    ],
    ikkeVurdert: [
      'Symptomer som ikke måles av enhetene – svimmelhet, tungpust, smerte eller uro.',
      'Pulsklokken var frakoblet 09.09 kl. 13:20–17:05. Systemet har ingen data fra de 3 timene og 45 minuttene.',
      'Om kveldsdosen tirsdag ble tatt manuelt utenom dispenseren.',
      'Måltider, væskeinntak og hvordan blodtrykksmålingene ble tatt (sittende, stående, mansjettplassering).',
    ],
  },
  oddmartin: {
    sammendrag: [
      'Døgnet har én akutt hendelse: glukosen falt fra 5,5 mmol/L kl. 02:02 til 3,1 mmol/L kl. 03:12 natt til fredag, og lå under nedre grense i om lag 40 minutter.',
      'Torsdag ettermiddag lå glukosen 4,4 over øvre grense kl. 15:32. Journalen oppgir måltid kl. 15:00 med bolus 6 E; bolusen er registrert på pumpen kl. 15:48.',
      'Tid i målområde har falt fra 74 % til 61 % over 14 dager. Vekten er ned 2,4 kg på 30 dager, og skrittellingen har falt fra om lag 4 500 til under 2 000 skritt per dag den siste uken.',
    ],
    ikkeVurdert: [
      'CGM-sensoren var uten kontakt 10.09 kl. 21:12–22:07. Systemet har ingen målinger fra de 55 minuttene.',
      'Måltider og karbohydratinntak registreres ikke, så systemet kjenner ikke grunnlaget for bolusdosene.',
      'Om hendelsen natt til fredag ble oppdaget og behandlet, og eventuelt med hva.',
      'Fysisk aktivitet som ikke fanges av skrittelleren, og symptomer som føling, svette eller uro.',
      'Aktivitetsmålerne fra Stegvis har vært nede siden kl. 08:55 i dag.',
    ],
  },
};

/* ══════════════════════════════════════════════════════════════════
   FELLESKOMPONENTER
   ══════════════════════════════════════════════════════════════════ */

const fokusring = 'focus:outline-none focus:ring-2 focus:ring-sky-700 focus:ring-offset-1';

function Merke({ niva, tekst, liten = false }) {
  const n = NIVA[niva];
  return (
    <span className={`inline-flex items-center gap-1 border ${n.kant} ${n.bg} ${n.tekst} ${liten ? 'px-1 text-xs' : 'px-1.5 py-0.5 text-xs'} font-semibold`}>
      <span aria-hidden="true">{n.glyph}</span>{tekst || n.navn}
    </span>
  );
}

function Panel({ tittel, ikon: Ikon, hoyre, kilde, children, className = '', markert = false, innerRef }) {
  return (
    <section
      ref={innerRef}
      className={`flex flex-col border bg-white ${markert ? 'border-amber-700 ring-2 ring-amber-400' : 'border-slate-300'} ${className}`}
    >
      <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
          {Ikon && <Ikon size={14} strokeWidth={2} className="text-slate-500" aria-hidden="true" />}
          {tittel}
        </h2>
        <div className="flex items-center gap-2">{hoyre}</div>
      </header>
      <div className="flex-1 p-3">{children}</div>
      {kilde && (
        <footer className="border-t border-slate-200 px-3 py-1 text-xs text-slate-500">Kilde: {kilde}</footer>
      )}
    </section>
  );
}

function Kpi({ etikett, verdi, enhet, tone }) {
  const farge = tone === 'akutt' ? F.akutt : tone === 'moderat' ? F.moderat : F.skifer;
  return (
    <div className="border border-slate-300 bg-white px-3 py-2">
      <div className="text-xs text-slate-600">{etikett}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-2xl font-semibold tabular-nums" style={{ color: farge }}>{verdi}</span>
        {enhet && <span className="text-xs text-slate-500">{enhet}</span>}
      </div>
    </div>
  );
}

function TT({ active, payload, label, enhet = '', desimaler = 1 }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="border border-slate-500 bg-white px-2 py-1 text-xs">
      <div className="font-semibold text-slate-800">{label}</div>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p, i) => (
        <div key={i} className="tabular-nums" style={{ color: p.color }}>
          {p.name}: {nb(p.value, desimaler)} {enhet}
        </div>
      ))}
    </div>
  );
}

const akseStil = { fontSize: 10, fill: '#475569' };

/* ─── Minigraf: nøyaktig det tidsvinduet flagget bygger på ──────── */
function MiniGraf({ g, hex }) {
  const punkt = (props) => {
    const { cx, cy, payload } = props;
    if (cx === null || cy === null || cy === undefined) return null;
    const av = g.avvikPunkter.includes(payload.t);
    return (
      <circle key={`p-${payload.t}`} cx={cx} cy={cy} r={av ? 4 : 1.6}
        fill={av ? hex : F.normal} stroke={av ? '#FFFFFF' : 'none'} strokeWidth={av ? 1.5 : 0} />
    );
  };
  const felles = (
    <>
      <CartesianGrid stroke="#E2E8F0" vertical={false} />
      <XAxis dataKey="t" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={18} />
      <YAxis domain={g.domain} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={34} />
      <Tooltip content={<TT enhet={g.enhet} desimaler={g.desimaler} />} />
      {g.band && <ReferenceArea y1={g.band.min} y2={g.band.max} fill={F.normal} fillOpacity={0.07} stroke="none" />}
      {g.grense !== undefined && (
        <ReferenceLine y={g.grense} stroke={F.moderat} strokeDasharray="4 3"
          label={{ value: `grense ${g.grense} min`, position: 'insideTopRight', fontSize: 10, fill: F.moderat }} />
      )}
    </>
  );
  return (
    <div>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {g.type === 'linje' ? (
            <LineChart data={g.data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              {felles}
              <Line type="monotone" dataKey="v" name="Måling" stroke={F.normal} strokeWidth={1.6}
                dot={punkt} isAnimationActive={false} connectNulls={false} />
            </LineChart>
          ) : (
            <BarChart data={g.data} margin={{ top: 8, right: 10, bottom: 0, left: 0 }}>
              {felles}
              <Bar dataKey="v" name="Avvik" isAnimationActive={false}>
                {g.data.map((d, i) => (
                  <Cell key={i} fill={g.avvikPunkter.includes(d.t) ? hex : F.enhet} />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        {g.xTittel} · verdier i {g.enhet}{g.band ? ' · skravert felt er normal-/målområdet' : ''}
      </p>
    </div>
  );
}

/* ─── Rådatatabell: de eksakte punktene i vinduet ───────────────── */
function Raadata({ r, hex }) {
  return (
    <div className="max-h-48 overflow-y-auto border border-slate-200">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 bg-slate-100">
          <tr>
            {r.kolonner.map((k) => (
              <th key={k} className="border-b border-slate-300 px-2 py-1 text-left font-semibold text-slate-700">{k}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {r.rader.map((rad, i) => {
            const av = r.avvikRader.includes(i);
            return (
              <tr key={i} className={av ? 'bg-amber-50' : i % 2 ? 'bg-slate-50' : ''}>
                {rad.map((celle, j) => (
                  <td key={j} className={`border-b border-slate-200 px-2 py-1 tabular-nums ${j === 0 ? 'text-slate-600' : 'font-medium text-slate-900'}`}
                    style={av && j > 0 ? { color: hex } : undefined}>
                    {av && j === 0 ? <span aria-hidden="true" className="mr-1">›</span> : null}{celle}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Datakortet: flagget med dataene det bygger på ─────────────── */
function Datakort({ f, visKnapp = true, onVis }) {
  const n = NIVA[f.niva];
  const p = pasient(f.pid);
  return (
    <article className={`border ${n.kant} bg-white`}>
      <header className={`flex flex-wrap items-center gap-x-3 gap-y-1 border-b ${n.kant} ${n.bg} px-3 py-2`}>
        <span className="text-sm font-semibold tabular-nums text-slate-900">{f.dato} kl. {f.tid}</span>
        <Merke niva={f.niva} />
        {f.utenVarsel && (
          <span className="border border-slate-400 bg-white px-1.5 py-0.5 text-xs text-slate-600">
            Utløste ikke varsel – mønster over tid
          </span>
        )}
        <span className="ml-auto text-xs text-slate-600">{f.kilde}</span>
      </header>

      <div className="px-3 py-2">
        <h4 className="text-sm font-semibold text-slate-900">{f.tittel}</h4>
        <p className="text-xs text-slate-600">{p.navn}, {p.alder} år · {p.distrikt}</p>

        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 border-y border-slate-200 py-2 text-xs sm:grid-cols-4">
          {[['Målt verdi', f.verdi.hoved], ['Referanse', f.verdi.referanse], ['Avvik', f.verdi.avvik], ['Endring', f.verdi.endring]].map(([k, v], i) => (
            <div key={k}>
              <dt className="text-slate-500">{k}</dt>
              <dd className={`tabular-nums ${i === 0 || i === 2 ? 'font-semibold' : 'text-slate-800'}`}
                style={i === 0 || i === 2 ? { color: n.hex } : undefined}>{v}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
          <MiniGraf g={f.minigraf} hex={n.hex} />
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-700">Målingene i vinduet</p>
            <Raadata r={f.raadata} hex={n.hex} />
          </div>
        </div>

        <blockquote className="mt-3 border-l-2 border-slate-400 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <span className="text-slate-500">Sammenholdt med journal: </span>«{f.journallinje}»
        </blockquote>

        <p className="mt-2 text-sm text-slate-800">{f.handling}</p>
      </div>

      {visKnapp && (
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-3 py-2">
          <span className="text-xs text-slate-500">
            Pekepunkt fra systemet. Ingen diagnose, ingen behandlingsanbefaling.
          </span>
          {p.full ? (
            <button onClick={() => onVis(f)}
              className={`inline-flex items-center gap-1 border border-slate-800 bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 ${fokusring}`}>
              <Eye size={13} aria-hidden="true" /> Vis i måledata
            </button>
          ) : (
            <span className="text-xs text-slate-500">Måledata for denne pasienten er ikke del av demodatasettet.</span>
          )}
        </footer>
      )}
    </article>
  );
}

/* ─── Kart: stilisert bykart tegnet som inline SVG ──────────────── */
/* Basiskartets farger er en egen serie og blandes aldri med alvorlighetsfargene. */
const KARTFARGER = {
  vann: '#AFC7D6', land: '#EDE9E2', kvartal: '#E0DCD3', park: '#C7D7BD',
  gate: '#FFFFFF', gatekant: '#D6D0C5', hovedvei: '#F4E7C6', hovedveikant: '#E0CE9E',
  kai: '#DAD5CB', skrift: '#6B675F',
  distriktslinje: '#8C97A1', distriktsskrift: '#475569',
};

/* Pasientsymbolene er derimot IKKE basiskart – de henter form og farge fra
   NIVA/F, slik at en endring i paletten slår rett ut i kartet. */
const KARTSYMBOL = {
  halo: F.panel,        // hvit skive bak symbolet, skiller det fra kartflaten
  kontur: F.panel,      // kontur rundt selve symbolet
  hovedring: F.skifer,  // ring ved peker/tastaturfokus
};

/* Vågen er en kile inn i landet. Begge bredder ligger langs samme akse. */
const seY = (x) => 289 - (x - 293) * 0.9899;   // sørøstre bredd
const nwY = (x) => 247 - (x - 251) * 0.9899;   // nordvestre bredd

function erLand(x, y) {
  if (x < 44 || x > 706 || y < 16 || y > 444) return false;
  if ((x - 585) * (x - 585) + (y - 330) * (y - 330) < 54 * 54) return false;   // Bytjernet
  if (x < 248) {                                                              // Vesttangen
    const t = ((x - 250) * -195 + (y - 330) * -145) / (195 * 195 + 145 * 145);
    const px = 250 - 195 * t, py = 330 - 145 * t;
    return t > 0.02 && t < 0.98 && (x - px) * (x - px) + (y - py) * (y - py) < 40 * 40;
  }
  if (x > 500) return true;
  return y > seY(x) + 16 || y < nwY(x) - 16;
}

const KVARTALER = (() => {
  const r = lcg(97), ut = [];
  for (let i = 0; i < 900 && ut.length < 130; i++) {
    const x = 44 + r() * 650, y = 16 + r() * 420, w = 9 + r() * 19, h = 7 + r() * 13;
    if (erLand(x, y) && erLand(x + w, y + h) && erLand(x + w, y) && erLand(x, y + h)) {
      ut.push({ x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) });
    }
  }
  return ut;
})();

const KAIER = [
  ...[0.2, 0.35, 0.5, 0.65, 0.8].map((t) => ({ x: 293 + 198 * t, y: 289 - 196 * t, v: 225 })),
  ...[0.25, 0.45, 0.65].map((t) => ({ x: 251 + 198 * t, y: 247 - 196 * t, v: 45 })),
  { x: 236, y: 372, v: 200 }, { x: 268, y: 398, v: 200 }, { x: 128, y: 292, v: 152 },
];

const KART = {
  land: [
    'M 300 0 L 283 55 L 272 120 L 258 185 L 251 247 L 449 51 Q 502 38 491 93 L 293 289 L 255 325 L 215 375 L 250 430 L 330 460 L 720 460 L 720 0 Z',
    'M 265 300 L 190 250 L 120 205 L 62 178 L 40 197 L 58 242 L 125 297 L 200 350 L 250 382 Z',
  ],
  parker: [
    'M 70 185 L 106 206 L 88 236 L 52 214 Z',
    'M 520 300 L 562 288 L 572 318 L 528 333 Z',
    'M 330 60 L 373 52 L 381 83 L 337 93 Z',
    'M 352 420 L 421 412 L 425 441 L 355 448 Z',
  ],
  hovedveier: [
    'M 305 6 C 332 92 362 152 420 212 C 470 264 520 302 558 362 C 584 402 598 432 608 458',
    'M 236 404 C 330 352 424 322 520 302 C 592 287 660 278 716 274',
  ],
  gater: [
    'M 262 240 L 452 62', 'M 307 294 L 498 104', 'M 332 122 L 472 252', 'M 382 58 L 562 222',
    'M 520 58 L 646 182', 'M 566 140 L 462 302', 'M 292 342 C 400 322 520 342 700 322',
    'M 352 442 L 644 430', 'M 622 200 L 700 384', 'M 238 320 L 68 190', 'M 206 344 L 112 246',
    'M 430 28 L 434 142', 'M 596 32 L 600 160', 'M 468 316 L 512 444', 'M 660 210 L 712 208',
  ],
  etiketter: [
    { x: 66, y: 96, t: 'Fjordvika', kursiv: true }, { x: 108, y: 418, t: 'Sørvågen', kursiv: true },
    { x: 356, y: 196, t: 'Vågen', kursiv: true, rot: -44.7 },
    { x: 96, y: 268, t: 'Vesttangen' }, { x: 340, y: 108, t: 'Kaien' },
    { x: 556, y: 332, t: 'Bytjernet', kursiv: true }, { x: 470, y: 250, t: 'Fjordvik sentrum' },
  ],
  distrikter: [
    { navn: 'Distrikt Nord', d: 'M 296 8 L 710 8 L 710 146 L 502 146 L 456 58 L 286 56 Z', etikett: [312, 24] },
    { navn: 'Distrikt Vest', d: 'M 256 300 L 180 240 L 110 195 L 55 178 L 38 204 L 120 302 L 216 376 Z', etikett: [78, 318] },
    { navn: 'Distrikt Sentrum', d: 'M 312 302 L 502 158 L 710 158 L 710 332 L 322 332 Z', etikett: [640, 176] },
    { navn: 'Distrikt Sør', d: 'M 262 348 L 710 344 L 710 452 L 316 452 Z', etikett: [278, 366] },
  ],
};

function Prikk({ p, valgt }) {
  /* Fargen kommer alltid fra NIVA – som igjen peker på F. Endres F, endres kartet. */
  const felles = { fill: NIVA[p.status].hex, stroke: KARTSYMBOL.kontur, strokeWidth: 1.8 };
  if (p.status === 'akutt') {
    return <polygon points={`${p.x},${p.y - 9} ${p.x + 8},${p.y + 5.5} ${p.x - 8},${p.y + 5.5}`} {...felles} />;
  }
  if (p.status === 'moderat') {
    return <rect x={p.x - 6} y={p.y - 6} width="12" height="12" transform={`rotate(45 ${p.x} ${p.y})`} {...felles} />;
  }
  return <circle cx={p.x} cy={p.y} r={valgt ? 6.5 : 5.5} {...felles} />;
}

function Kart({ pasienter, onVelg, rolig }) {
  const [hover, setHover] = useState(null);
  return (
    <div className="relative">
      <svg viewBox="0 0 720 460" className="w-full border border-slate-300" role="img"
        aria-label="Kart over Fjordvik kommune med pasientenes distrikt og status">
        <rect x="0" y="0" width="720" height="460" fill={KARTFARGER.vann} />
        {KART.land.map((d, i) => <path key={i} d={d} fill={KARTFARGER.land} />)}

        {KAIER.map((k, i) => (
          <rect key={i} x={k.x} y={k.y - 3.5} width="26" height="7" fill={KARTFARGER.kai}
            transform={`rotate(${k.v} ${k.x} ${k.y})`} />
        ))}
        {KVARTALER.map((b, i) => <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={KARTFARGER.kvartal} />)}
        {KART.parker.map((d, i) => <path key={i} d={d} fill={KARTFARGER.park} />)}
        <circle cx="585" cy="330" r="46" fill={KARTFARGER.vann} />

        {KART.hovedveier.map((d, i) => <path key={`hk${i}`} d={d} fill="none" stroke={KARTFARGER.hovedveikant} strokeWidth="11" strokeLinecap="round" />)}
        {KART.hovedveier.map((d, i) => <path key={`h${i}`} d={d} fill="none" stroke={KARTFARGER.hovedvei} strokeWidth="8" strokeLinecap="round" />)}
        {KART.gater.map((d, i) => <path key={`gk${i}`} d={d} fill="none" stroke={KARTFARGER.gatekant} strokeWidth="6" strokeLinecap="round" />)}
        {KART.gater.map((d, i) => <path key={`g${i}`} d={d} fill="none" stroke={KARTFARGER.gate} strokeWidth="4" strokeLinecap="round" />)}

        {KART.etiketter.map((e) => (
          <text key={e.t} x={e.x} y={e.y} fontSize="11" fill={KARTFARGER.skrift}
            fontStyle={e.kursiv ? 'italic' : 'normal'}
            transform={e.rot ? `rotate(${e.rot} ${e.x} ${e.y})` : undefined}>{e.t}</text>
        ))}

        {KART.distrikter.map((d) => (
          <g key={d.navn}>
            <path d={d.d} fill="none" stroke={KARTFARGER.distriktslinje} strokeWidth="1.2" strokeDasharray="7 6" />
            <text x={d.etikett[0]} y={d.etikett[1]} fontSize="11" fontWeight="700" fill={KARTFARGER.distriktsskrift}>
              {d.navn.replace('Distrikt ', '')}
            </text>
          </g>
        ))}

        {pasienter.map((p) => (
          <g key={p.id} tabIndex={0} role="button"
            aria-label={`${p.navn}, ${p.alder} år, ${p.distrikt}, ${NIVA[p.status].navn}`}
            className="cursor-pointer focus:outline-none"
            onClick={() => onVelg(p.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onVelg(p.id); } }}
            onMouseEnter={() => setHover(p)} onMouseLeave={() => setHover(null)}
            onFocus={() => setHover(p)} onBlur={() => setHover(null)}>
            <circle cx={p.x} cy={p.y} r="10" fill={KARTSYMBOL.halo} opacity="0.85" />
            {p.status === 'akutt' && !rolig && (
              <circle cx={p.x} cy={p.y} r="11" fill="none" stroke={NIVA.akutt.hex} strokeWidth="2">
                <animate attributeName="r" values="11;26" dur="2.4s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.75;0" dur="2.4s" repeatCount="indefinite" />
              </circle>
            )}
            {hover?.id === p.id && <circle cx={p.x} cy={p.y} r="13" fill="none" stroke={KARTSYMBOL.hovedring} strokeWidth="2" />}
            <Prikk p={p} valgt={hover?.id === p.id} />
          </g>
        ))}
      </svg>

      {hover && (
        <div className="pointer-events-none absolute z-10 w-56 -translate-x-1/2 -translate-y-full border border-slate-700 bg-white px-2 py-1.5 shadow-sm"
          style={{ left: `${(hover.x / 720) * 100}%`, top: `${((hover.y - 16) / 460) * 100}%` }}>
          <div className="text-sm font-semibold text-slate-900">{hover.navn}</div>
          <div className="text-xs text-slate-600">{hover.alder} år · {hover.distrikt}</div>
          <div className="mt-1"><Merke niva={hover.status} /></div>
          <div className="mt-1 text-xs text-slate-700">{hover.avvik || 'Ingen aktive avvik'}</div>
          <div className="mt-1 text-xs text-slate-500">Klikk for å åpne pasienten</div>
        </div>
      )}
    </div>
  );
}

function Tegnforklaring() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
      {[
        ['normal', 'Normalt – målinger innenfor pasientens eget referanseområde'],
        ['moderat', 'Moderat avvik – bør ses på, ikke akutt'],
        ['akutt', 'Akutt avvik – krever oppfølging nå'],
      ].map(([k, tekst]) => (
        <span key={k} className="flex items-center gap-1.5">
          <span aria-hidden="true" className="text-sm" style={{ color: NIVA[k].hex }}>{NIVA[k].glyph}</span>
          {tekst}
        </span>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   VENSTREMENY OG TOPPLINJE
   ══════════════════════════════════════════════════════════════════ */

function Sidemeny({ side, gaTil, distrikt, setDistrikt, niva, setNiva, tilkoblede }) {
  const menyknapp = (aktiv) =>
    `flex w-full items-center gap-2 border-l-2 px-3 py-1.5 text-left text-sm ${fokusring} ${
      aktiv ? 'border-sky-400 bg-slate-800 font-semibold text-white' : 'border-transparent text-slate-300 hover:bg-slate-800'
    }`;

  return (
    <nav className="sticky top-0 flex h-screen w-56 shrink-0 flex-col overflow-y-auto bg-slate-900 text-slate-200 xl:w-64">
      <div className="border-b border-slate-700 px-3 py-3">
        <div className="text-sm font-semibold tracking-tight text-white">Fjordvik kommune</div>
        <div className="text-xs text-slate-400">Driftssenter hjemmetjeneste</div>
      </div>

      <div className="py-2">
        <button className={menyknapp(side === 'oversikt')} onClick={() => gaTil('oversikt')}>
          <LayoutDashboard size={15} aria-hidden="true" /> Oversikt
        </button>
        <button className={menyknapp(side === 'sok')} onClick={() => gaTil('sok')}>
          <Users size={15} aria-hidden="true" /> Pasientsøk
        </button>
      </div>

      <div className="border-t border-slate-700 px-3 py-3">
        <label className="block text-xs font-semibold text-slate-400" htmlFor="distriktsfilter">Distrikt</label>
        <select id="distriktsfilter" value={distrikt} onChange={(e) => setDistrikt(e.target.value)}
          className={`mt-1 w-full border border-slate-600 bg-slate-800 px-2 py-1 text-sm text-white ${fokusring}`}>
          <option value="alle">Alle distrikter</option>
          {DISTRIKTER.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>

        <p className="mt-3 text-xs font-semibold text-slate-400">Alvorlighet</p>
        <div className="mt-1 flex flex-col gap-1">
          {[['alle', 'Alle'], ['moderat', 'Moderate'], ['akutt', 'Akutte']].map(([v, navn]) => (
            <button key={v} onClick={() => setNiva(v)}
              className={`flex items-center gap-2 border px-2 py-1 text-left text-sm ${fokusring} ${
                niva === v ? 'border-slate-400 bg-slate-700 text-white' : 'border-slate-700 text-slate-300 hover:bg-slate-800'}`}>
              {v !== 'alle' && <span aria-hidden="true" style={{ color: NIVA[v].hex === F.moderat ? '#FBBF24' : '#FCA5A5' }}>{NIVA[v].glyph}</span>}
              {navn}
            </button>
          ))}
        </div>
      </div>

      <div className="border-t border-slate-700 px-3 py-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-slate-400">Datakilder</p>
          <span className="text-xs tabular-nums text-slate-400">{tilkoblede} av {DATAKILDER.length}</span>
        </div>
        <p className="mt-1 text-xs leading-snug text-slate-500">
          Plattformen henter data fra alle leverandører. Ingen av enhetene er våre egne.
        </p>
        <ul className="mt-2 flex flex-col gap-1.5">
          {DATAKILDER.map((k) => {
            const s = KILDESTATUS[k.status];
            return (
              <li key={k.id} className="border border-slate-700 bg-slate-800 px-2 py-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-white">{k.navn}</span>
                  <span className={`flex items-center gap-1 border px-1 text-xs ${s.klasse}`}>
                    <span aria-hidden="true">{s.glyph}</span>{s.navn}
                  </span>
                </div>
                <div className="text-xs text-slate-400">{k.type}</div>
                <div className="text-xs tabular-nums text-slate-500">
                  {k.enheter} enheter · sist synk. kl. {k.synk}
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="mt-auto border-t border-slate-700 px-3 py-3 text-xs text-slate-400">
        <div className="font-medium text-slate-300">{INNLOGGET.navn}</div>
        <div>{INNLOGGET.rolle}</div>
      </div>
    </nav>
  );
}

function Topplinje({ tittel, tilbake, onTilbake }) {
  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-4 py-2">
      {tilbake && (
        <button onClick={onTilbake} className={`inline-flex items-center gap-1 border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 ${fokusring}`}>
          <ArrowLeft size={13} aria-hidden="true" /> {tilbake}
        </button>
      )}
      <h1 className="text-base font-semibold text-slate-900">{tittel}</h1>
      <span className="border border-amber-700 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900">
        Demodata – fiktive pasienter
      </span>
      <span className="ml-auto text-xs tabular-nums text-slate-500">
        Sist synkronisert {DEMO_DATO} kl. {DEMO_KLOKKE}
      </span>
    </header>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SKJERMBILDE 1: OVERSIKT
   ══════════════════════════════════════════════════════════════════ */

function Varselrad({ v, kvittering, onKvitter, onApne, onDatakort }) {
  const n = NIVA[v.niva];
  const kv = kvittering || (v.kvittertAv ? { av: v.kvittertAv, tid: v.kvittertTid } : null);
  return (
    <li className={`border-l-4 border-b border-b-slate-200 px-3 py-2 ${kv ? 'bg-slate-50' : 'bg-white'}`} style={{ borderLeftColor: n.hex }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold tabular-nums text-slate-900">kl. {v.tid}</span>
        <span className="text-xs tabular-nums text-slate-500">{v.dato}</span>
        <Merke niva={v.niva} />
        {kv && (
          <span className="flex items-center gap-1 border border-teal-700 bg-teal-50 px-1.5 py-0.5 text-xs font-semibold text-teal-900">
            <Check size={11} aria-hidden="true" /> Kvittert
          </span>
        )}
      </div>
      <p className="mt-0.5 text-sm font-medium text-slate-900">{pasient(v.pid).navn}, {pasient(v.pid).alder} år · {pasient(v.pid).distrikt}</p>
      <p className="text-sm text-slate-700">{v.hva}</p>
      <p className="text-xs text-slate-500">{v.kilde}</p>
      {kv ? (
        <p className="mt-1 border-t border-slate-200 pt-1 text-xs text-slate-600">
          Kvittert av {kv.av} · {kv.tid}
        </p>
      ) : (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <button onClick={() => onApne(v.pid)} className={`border border-slate-800 bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 ${fokusring}`}>
            Åpne pasient
          </button>
          {v.flagg && (
            <button onClick={() => onDatakort(v.flagg)} className={`border border-slate-400 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 ${fokusring}`}>
              Vis datakort
            </button>
          )}
          <button onClick={() => onKvitter(v.id)} className={`border border-slate-400 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 ${fokusring}`}>
            Kvitter
          </button>
        </div>
      )}
    </li>
  );
}

function Oversikt({ distrikt, niva, kvitteringer, onKvitter, onApne, onDatakort, rolig }) {
  const synligePasienter = PASIENTER.filter(
    (p) => (distrikt === 'alle' || p.distrikt === distrikt) && (niva === 'alle' || p.status === niva)
  );
  const synligeVarsler = VARSLER.filter(
    (v) => (distrikt === 'alle' || pasient(v.pid).distrikt === distrikt) && (niva === 'alle' || v.niva === niva)
  );
  const apne = VARSLER.filter((v) => !kvitteringer[v.id] && !v.kvittertAv);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Kpi etikett="Aktive pasienter" verdi="128" />
        <Kpi etikett="Tilkoblede enheter" verdi="1 075" />
        <Kpi etikett="Åpne varsler" verdi={apne.length} tone={apne.length ? 'moderat' : undefined} />
        <Kpi etikett="Akutte varsler nå" verdi={apne.filter((v) => v.niva === 'akutt').length} tone="akutt" />
        <Kpi etikett="Datakilder tilkoblet" verdi={`${DATAKILDER.filter((k) => k.status === 'tilkoblet').length} / ${DATAKILDER.length}`} />
        <Kpi etikett="Planlagte tilsyn i dag" verdi="23" />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7" tittel="Pasienter i kommunen"
          hoyre={<span className="text-xs tabular-nums text-slate-500">{synligePasienter.length} av {PASIENTER.length} vises</span>}>
          {synligePasienter.length ? (
            <Kart pasienter={synligePasienter} onVelg={onApne} rolig={rolig} />
          ) : (
            <div className="flex h-64 flex-col items-center justify-center gap-2 border border-dashed border-slate-300 text-center">
              <p className="text-sm text-slate-700">Ingen pasienter treffer filteret.</p>
              <p className="text-xs text-slate-500">Sett alvorlighet til «Alle» eller velg et annet distrikt i menyen.</p>
            </div>
          )}
          <div className="mt-2 border-t border-slate-200 pt-2"><Tegnforklaring /></div>
        </Panel>

        <Panel className="lg:col-span-5" tittel="Varsler" ikon={Bell}
          hoyre={<span className="text-xs tabular-nums text-slate-500">sortert på tid</span>}>
          {synligeVarsler.length ? (
            <ul className="-mx-3 -my-1 max-h-96 overflow-y-auto border-y border-slate-200">
              {synligeVarsler.map((v) => (
                <Varselrad key={v.id} v={v} kvittering={kvitteringer[v.id]}
                  onKvitter={onKvitter} onApne={onApne} onDatakort={onDatakort} />
              ))}
            </ul>
          ) : (
            <div className="flex h-40 flex-col items-center justify-center gap-2 border border-dashed border-slate-300 text-center">
              <p className="text-sm text-slate-700">Ingen varsler med dette filteret.</p>
              <p className="text-xs text-slate-500">Velg «Alle» under alvorlighet for å se hele strømmen.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel tittel="Avvik per distrikt, siste 7 dager">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={AVVIK_PER_DISTRIKT} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="distrikt" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} />
                <YAxis tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={26} />
                <Tooltip content={<TT enhet="avvik" desimaler={0} />} />
                <Bar dataKey="moderat" name="Moderate" stackId="a" fill={F.moderat} isAnimationActive={false} />
                <Bar dataKey="akutt" name="Akutte" stackId="a" fill={F.akutt} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-slate-500">Nedre del av søylen er moderate avvik, øvre del er akutte.</p>
        </Panel>

        <Panel tittel="Medisinetterlevelse i kommunen, siste 7 dager" ikon={Pill}>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={ETTERLEVELSE_UKE} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="dag" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: F.linje }} interval={0} />
                <YAxis domain={[0, 100]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={30} unit="%" />
                <Tooltip content={<TT enhet="%" desimaler={0} />} />
                <Bar dataKey="tatt" name="Tatt" stackId="a" fill={F.enhet} isAnimationActive={false} />
                <Bar dataKey="forsinket" name="Forsinket" stackId="a" fill={F.moderat} isAnimationActive={false} />
                <Bar dataKey="ikke" name="Ikke tatt" stackId="a" fill={F.akutt} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-slate-500">Andel dispenserte doser som ble kvittert i tide.</p>
        </Panel>

        <Panel tittel="Varselvolum etter alvorlighet, 14 dager">
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={VARSELVOLUM} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#E2E8F0" vertical={false} />
                <XAxis dataKey="dato" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={14} />
                <YAxis tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={26} />
                <Tooltip content={<TT enhet="varsler" desimaler={0} />} />
                <Line type="monotone" dataKey="moderat" name="Moderate" stroke={F.moderat} strokeWidth={1.8} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="akutt" name="Akutte" stroke={F.akutt} strokeWidth={1.8} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-slate-500">Heltrukket linje er moderate avvik, stiplet er akutte.</p>
        </Panel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SKJERMBILDE 2: PASIENTSØK
   ══════════════════════════════════════════════════════════════════ */

function Pasientsok({ distrikt, niva, onApne }) {
  const [sok, setSok] = useState('');
  const treff = useMemo(() => PASIENTER.filter((p) =>
    (distrikt === 'alle' || p.distrikt === distrikt) &&
    (niva === 'alle' || p.status === niva) &&
    (sok.trim() === '' || p.navn.toLowerCase().includes(sok.toLowerCase().trim()))
  ), [sok, distrikt, niva]);

  const kol = 'grid grid-cols-12 gap-2 px-3 py-2 text-sm';

  return (
    <Panel tittel="Pasientsøk" ikon={Users}
      hoyre={<span className="text-xs tabular-nums text-slate-500">{treff.length} pasienter</span>}>
      <div className="mb-2 flex items-center gap-2 border border-slate-300 px-2 py-1">
        <Search size={15} className="text-slate-500" aria-hidden="true" />
        <input value={sok} onChange={(e) => setSok(e.target.value)} placeholder="Søk på navn"
          aria-label="Søk på pasientnavn"
          className={`w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none`} />
        {sok && (
          <button onClick={() => setSok('')} aria-label="Tøm søket" className={`text-slate-500 hover:text-slate-900 ${fokusring}`}>
            <X size={14} />
          </button>
        )}
      </div>
      <p className="mb-2 text-xs text-slate-500">Distrikt og alvorlighet styres av filtrene i venstremenyen.</p>

      <div className={`${kol} border-y border-slate-300 bg-slate-100 font-semibold text-slate-700`}>
        <span className="col-span-3">Navn</span>
        <span className="col-span-1">Alder</span>
        <span className="col-span-2">Distrikt</span>
        <span className="col-span-1">Enheter</span>
        <span className="col-span-2">Status</span>
        <span className="col-span-2">Siste måling</span>
        <span className="col-span-1">Neste tilsyn</span>
      </div>

      {treff.length ? (
        <ul>
          {treff.map((p) => (
            <li key={p.id}>
              <button onClick={() => onApne(p.id)}
                className={`${kol} w-full items-center border-b border-slate-200 text-left hover:bg-sky-50 ${fokusring}`}>
                <span className="col-span-3 flex items-center gap-1 font-medium text-slate-900">
                  {p.navn}
                  {p.full && <span className="border border-slate-300 px-1 text-xs font-normal text-slate-500">full demo</span>}
                </span>
                <span className="col-span-1 tabular-nums text-slate-700">{p.alder}</span>
                <span className="col-span-2 text-slate-700">{p.distrikt}</span>
                <span className="col-span-1 tabular-nums text-slate-700">{p.enheter.length}</span>
                <span className="col-span-2"><Merke niva={p.status} /></span>
                <span className="col-span-2 tabular-nums text-slate-700">{p.sisteMaling}</span>
                <span className="col-span-1 text-slate-700">{p.nesteTilsyn}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex h-40 flex-col items-center justify-center gap-2 border border-dashed border-slate-300 text-center">
          <p className="text-sm text-slate-700">Ingen pasienter treffer søket.</p>
          <p className="text-xs text-slate-500">Tøm søkefeltet, eller sett distrikt og alvorlighet til «Alle» i venstremenyen.</p>
        </div>
      )}
    </Panel>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SKJERMBILDE 3–4: PASIENTSIDE – modulene styres av enhetene
   ══════════════════════════════════════════════════════════════════ */

function Markering({ vindu, onFjern }) {
  if (!vindu) return null;
  return (
    <span className="flex items-center gap-1 border border-amber-700 bg-amber-50 px-1.5 py-0.5 text-xs font-semibold text-amber-900">
      Markert fra ukesrapporten
      <button onClick={onFjern} className={`ml-1 text-amber-900 hover:text-amber-700 ${fokusring}`} aria-label="Fjern markering">
        <X size={12} />
      </button>
    </span>
  );
}

function Journalutdrag({ j }) {
  return (
    <Panel tittel="Journalutdrag" ikon={FileText} kilde="Journal (EPJ) · statisk utdrag i demoen">
      <dl className="flex flex-col gap-2 text-sm">
        <div>
          <dt className="text-xs font-semibold text-slate-500">Diagnoser</dt>
          <dd className="text-slate-800">{j.diagnoser.join(' · ')}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Medisinliste</dt>
          <dd><ul className="list-inside list-disc text-slate-800">{j.medisiner.map((m) => <li key={m}>{m}</li>)}</ul></dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Rutiner</dt>
          <dd><ul className="list-inside list-disc text-slate-800">{j.rutiner.map((m) => <li key={m}>{m}</li>)}</ul></dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-slate-500">Pårørende</dt>
          <dd className="text-slate-800">{j.parorende}</dd>
        </div>
      </dl>
    </Panel>
  );
}

function Besoksfrekvens({ p, overstyrt, setOverstyrt }) {
  const s = SENSORDEKNING[p.id];
  const gjeldende = overstyrt ?? s.planlagt;
  const frigjort = Math.max(0, s.planlagt - s.anbefalt);
  return (
    <Panel tittel="Sensordekning og besøksfrekvens" ikon={Gauge} kilde="Beregnet av plattformen på tvers av alle tilkoblede enheter">
      <div className="flex items-baseline gap-2">
        <span className="text-3xl font-semibold tabular-nums" style={{ color: F.enhet }}>{s.dekning} %</span>
        <span className="text-sm text-slate-600">sensordekning</span>
      </div>
      <div className="mt-1 h-2 w-full border border-slate-300 bg-slate-100">
        <div className="h-full" style={{ width: `${s.dekning}%`, backgroundColor: F.enhet }} />
      </div>
      <p className="mt-1 text-xs text-slate-500">{s.grunnlag}</p>

      <dl className="mt-3 grid grid-cols-3 gap-2 border-y border-slate-200 py-2 text-sm">
        <div><dt className="text-xs text-slate-500">Anbefalt</dt><dd className="font-semibold tabular-nums text-slate-900">{s.anbefalt} tilsyn/uke</dd></div>
        <div><dt className="text-xs text-slate-500">Planlagt i dag</dt><dd className="font-semibold tabular-nums text-slate-900">{s.planlagt} tilsyn/uke</dd></div>
        <div><dt className="text-xs text-slate-500">Gjeldende</dt><dd className="font-semibold tabular-nums text-slate-900">{gjeldende} tilsyn/uke</dd></div>
      </dl>

      <p className="mt-2 text-xs font-semibold text-slate-600">Overstyr frekvensen manuelt</p>
      <div className="mt-1 flex gap-1">
        {[1, 2, 3, 4].map((n) => (
          <button key={n} onClick={() => setOverstyrt(n)}
            className={`border px-2 py-1 text-sm tabular-nums ${fokusring} ${
              gjeldende === n ? 'border-slate-800 bg-slate-800 font-semibold text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
            {n}
          </button>
        ))}
        {overstyrt != null && (
          <button onClick={() => setOverstyrt(null)} className={`border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 ${fokusring}`}>
            Tilbakestill
          </button>
        )}
      </div>

      {s.laast ? (
        <p className="mt-2 border-l-2 border-red-700 bg-red-50 px-2 py-1 text-xs text-red-900">{s.laast}</p>
      ) : (
        <p className="mt-2 text-xs text-slate-600">
          {frigjort > 0
            ? `Dekningen tilsvarer ${frigjort} tilsyn per uke, om lag ${frigjort * 52} tilsyn i året for denne pasienten.`
            : 'Anbefalingen er lik den planlagte frekvensen.'}
        </p>
      )}
      <p className="mt-1 text-xs text-slate-500">
        Anbefalingen er beslutningsstøtte. Endring av tilsynsfrekvens besluttes av tjenesten.
      </p>
    </Panel>
  );
}

function EgenVurdering({ p, vurdering, onLagre, innerRef, fremhevet }) {
  const [status, setStatus] = useState(vurdering?.status || '');
  const [notat, setNotat] = useState(vurdering?.notat || '');
  const [gjennomgatt, setGjennomgatt] = useState(vurdering?.gjennomgatt || []);
  const [rediger, setRediger] = useState(!vurdering);

  const veksle = (m) => setGjennomgatt((g) => (g.includes(m) ? g.filter((x) => x !== m) : [...g, m]));
  const valg = [['stabil', 'Stabil'], ['folges', 'Bør følges opp'], ['tiltak', 'Krever tiltak']];

  if (vurdering && !rediger) {
    return (
      <Panel innerRef={innerRef} tittel="Egen vurdering" ikon={ClipboardList}
        hoyre={<button onClick={() => setRediger(true)} className={`border border-slate-300 px-2 py-0.5 text-xs text-slate-700 hover:bg-slate-100 ${fokusring}`}>Endre</button>}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={16} style={{ color: F.enhet }} aria-hidden="true" />
          <span className="text-sm font-semibold text-slate-900">{valg.find((v) => v[0] === vurdering.status)?.[1]}</span>
        </div>
        <p className="mt-1 text-xs tabular-nums text-slate-600">Registrert av {vurdering.av} · {vurdering.tid}</p>
        <p className="mt-1 text-xs text-slate-600">
          Gjennomgått: {vurdering.gjennomgatt.length ? vurdering.gjennomgatt.map((m) => MODULNAVN[m]).join(', ') : 'ingen moduler huket av'}
        </p>
        {vurdering.notat && <p className="mt-2 border-l-2 border-slate-300 pl-2 text-sm text-slate-800">{vurdering.notat}</p>}
        <p className="mt-2 text-xs text-slate-500">Ukesrapporten er nå åpen.</p>
      </Panel>
    );
  }

  return (
    <Panel innerRef={innerRef} tittel="Egen vurdering" ikon={ClipboardList} markert={fremhevet}>
      <p className="text-sm text-slate-700">
        Les gjennom måledataene og registrer din egen vurdering. Ukesrapporten fra AI-en åpnes først etterpå.
      </p>
      <fieldset className="mt-2">
        <legend className="text-xs font-semibold text-slate-600">Status</legend>
        <div className="mt-1 flex flex-wrap gap-1">
          {valg.map(([v, navn]) => (
            <button key={v} onClick={() => setStatus(v)} aria-pressed={status === v}
              className={`border px-2 py-1 text-sm ${fokusring} ${
                status === v ? 'border-slate-800 bg-slate-800 font-semibold text-white' : 'border-slate-300 text-slate-700 hover:bg-slate-100'}`}>
              {navn}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="mt-3">
        <legend className="text-xs font-semibold text-slate-600">Hvilke moduler har du gjennomgått?</legend>
        <div className="mt-1 flex flex-wrap gap-3">
          {PASIENT_MODULER[p.id].map((m) => (
            <label key={m} className="flex items-center gap-1.5 text-sm text-slate-800">
              <input type="checkbox" checked={gjennomgatt.includes(m)} onChange={() => veksle(m)}
                className={`h-4 w-4 border-slate-400 ${fokusring}`} />
              {MODULNAVN[m]}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="mt-3 block text-xs font-semibold text-slate-600" htmlFor="notat">Notat (valgfritt)</label>
      <textarea id="notat" rows={2} value={notat} onChange={(e) => setNotat(e.target.value)}
        placeholder="Kort om hva du så i dataene"
        className={`mt-1 w-full border border-slate-300 px-2 py-1 text-sm ${fokusring}`} />

      <div className="mt-2 flex items-center gap-2">
        <button disabled={!status} onClick={() => { onLagre({ status, notat, gjennomgatt }); setRediger(false); }}
          className={`border px-3 py-1 text-sm font-semibold ${fokusring} ${
            status ? 'border-slate-800 bg-slate-800 text-white hover:bg-slate-700' : 'cursor-not-allowed border-slate-300 bg-slate-100 text-slate-400'}`}>
          Bekreft vurdering
        </button>
        {!status && <span className="text-xs text-slate-500">Velg en status for å bekrefte.</span>}
      </div>
    </Panel>
  );
}

/* ─── Moduler for Ingrid Bakke: dispenser, puls, blodtrykk, fall ── */
function ModulerIngrid({ settRef, vindu, onFjern }) {
  const markert = (m) => vindu?.modul === m;
  return (
    <>
      <Panel innerRef={settRef('puls')} tittel="Puls" ikon={HeartPulse} markert={markert('puls')}
        kilde="Pulsklokke NS-4 · NordSensor" className="lg:col-span-2"
        hoyre={markert('puls') ? <Markering vindu={vindu} onFjern={onFjern} /> : <span className="text-xs text-slate-500">siste 24 timer</span>}>
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={PULS_24T} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="t" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={34} />
                  <YAxis domain={[50, 105]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={30} />
                  <Tooltip content={<TT enhet="slag/min" desimaler={0} />} />
                  <ReferenceArea y1={55} y2={90} fill={F.normal} fillOpacity={0.07} stroke="none" />
                  <ReferenceArea x1={PULS_VINDU.fra} x2={PULS_VINDU.til} fill={F.moderat}
                    fillOpacity={markert('puls') ? 0.24 : 0.1} stroke={markert('puls') ? F.moderat : 'none'} strokeDasharray="4 3"
                    label={{ value: 'avviksvindu', position: 'insideTop', fontSize: 10, fill: F.moderat }} />
                  <Line type="monotone" dataKey="v" name="Puls" stroke={F.normal} strokeWidth={1.7} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-1 text-xs text-slate-500">Skravert blått felt er pasientens eget normalområde (55–90 slag/min).</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-600">Hvilepuls, siste 7 dager</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={HVILEPULS_7D} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
                  <CartesianGrid stroke="#E2E8F0" vertical={false} />
                  <XAxis dataKey="dato" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: F.linje }} interval={0} />
                  <YAxis domain={[55, 95]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={28} />
                  <Tooltip content={<TT enhet="slag/min" desimaler={0} />} />
                  <ReferenceArea y1={58} y2={74} fill={F.normal} fillOpacity={0.07} stroke="none" />
                  <Line type="monotone" dataKey="v" name="Hvilepuls" stroke={F.moderat} strokeWidth={1.8}
                    dot={{ r: 2.5, fill: F.moderat }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </Panel>

      <Panel innerRef={settRef('medisin')} tittel="Medisinering" ikon={Pill} markert={markert('medisin')}
        kilde="Dispenser MD-7 · MedDispense" className="lg:col-span-2"
        hoyre={markert('medisin') ? <Markering vindu={vindu} onFjern={onFjern} /> : <span className="text-xs text-slate-500">siste 7 dager</span>}>
        <div className="overflow-x-auto">
          <div className="grid min-w-max grid-cols-8 gap-1 text-xs">
            <div />
            {MEDISIN_7D.map((d) => (
              <div key={d.dato} className="px-1 text-center font-semibold text-slate-700">{d.dag}<br /><span className="tabular-nums font-normal text-slate-500">{d.dato}</span></div>
            ))}
            {[['morgen', 'Morgen kl. 08:00', 'Furosemid 20 mg'], ['kveld', 'Kveld kl. 20:00', 'Metoprolol 25 mg']].map(([nokkel, tittel, medisin]) => (
              <React.Fragment key={nokkel}>
                <div className="flex flex-col justify-center pr-2 text-slate-700">
                  <span className="font-semibold">{tittel}</span>
                  <span className="text-slate-500">{medisin}</span>
                </div>
                {MEDISIN_7D.map((d) => {
                  const s = DOSESTATUS[d[nokkel].status];
                  const ring = markert('medisin') && vindu.celle === d.dato && nokkel === 'kveld';
                  return (
                    <div key={d.dato} className={`border px-1 py-2 text-center ${s.klasse} ${ring ? 'ring-2 ring-amber-500' : ''}`}>
                      <div className="text-base leading-none" aria-hidden="true">{s.glyph}</div>
                      <div className="mt-1 font-semibold">{s.navn}</div>
                      <div className="tabular-nums">{d[nokkel].tid ? `kl. ${d[nokkel].tid}` : '–'}</div>
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Doser regnes som forsinket etter 30 minutter. Ruten for kveldsdosen tirsdag 08.09 står uten registrering.
        </p>
      </Panel>

      <Panel innerRef={settRef('blodtrykk')} tittel="Blodtrykk" ikon={Activity} markert={markert('blodtrykk')}
        kilde="Blodtrykksmåler NS-2 · NordSensor"
        hoyre={markert('blodtrykk') ? <Markering vindu={vindu} onFjern={onFjern} /> : <span className="text-xs text-slate-500">14 dager</span>}>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={BLODTRYKK_14D} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="dato" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: F.linje }} interval={0} />
              <YAxis domain={[70, 175]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={30} />
              <Tooltip content={<TT enhet="mmHg" desimaler={0} />} />
              <ReferenceLine y={140} stroke={F.moderat} strokeDasharray="4 3"
                label={{ value: 'mål 140', position: 'insideTopLeft', fontSize: 10, fill: F.moderat }} />
              {markert('blodtrykk') && (
                <ReferenceArea x1={vindu.fra} x2={vindu.til} fill={F.moderat} fillOpacity={0.2} stroke={F.moderat} strokeDasharray="4 3" />
              )}
              <Line type="monotone" dataKey="kveldSys" name="Systolisk kveld" stroke={F.moderat} strokeWidth={2} dot={{ r: 2.5 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="kveldDia" name="Diastolisk kveld" stroke={F.normal} strokeWidth={1.6} dot={{ r: 2 }} isAnimationActive={false} />
              <Line type="monotone" dataKey="morgenSys" name="Systolisk morgen" stroke="#94A3B8" strokeWidth={1.4} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Kveldsmålingene er heltrukne. Den stiplede grå linjen er systolisk morgenmåling, uendret i perioden.
        </p>
      </Panel>

      <Panel innerRef={settRef('aktivitet')} tittel="Aktivitet og fall" ikon={Footprints} markert={markert('aktivitet')}
        kilde="Dør- og bevegelsessensor TH-1 · Trygg Hjem">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={AKTIVITET_14D} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="dato" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: F.linje }} interval={0} />
              <YAxis yAxisId="v" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={26} />
              <YAxis yAxisId="h" orientation="right" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={30} />
              <Tooltip content={<TT desimaler={0} />} />
              <Bar yAxisId="v" dataKey="dorapninger" name="Døråpninger" fill={F.enhet} isAnimationActive={false} />
              <Line yAxisId="h" type="monotone" dataKey="bevegelser" name="Bevegelseshendelser" stroke="#64748B" strokeWidth={1.6} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 flex items-center gap-1.5 border border-teal-700 bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-900">
          <ShieldCheck size={14} aria-hidden="true" /> Ingen fall registrert siste 14 dager
        </p>
      </Panel>
    </>
  );
}

/* ─── Moduler for Odd Martin Nilsen: CGM, pumpe, vekt, skritt ───── */
function ModulerOdd({ settRef, vindu, onFjern }) {
  const markert = (m) => vindu?.modul === m;
  return (
    <>
      <Panel innerRef={settRef('glukose')} tittel="Glukose" ikon={Droplet} markert={markert('glukose')}
        kilde="CGM G6-Nord · GlukoLink · måling hvert 5. minutt" className="lg:col-span-2"
        hoyre={markert('glukose') ? <Markering vindu={vindu} onFjern={onFjern} /> : <span className="text-xs text-slate-500">siste døgn</span>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={GLUKOSE_24T} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="t" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={44} />
              <YAxis domain={[2, 14]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={30} />
              <Tooltip content={<TT enhet="mmol/L" desimaler={1} />} />
              <ReferenceArea y1={GLUK_MAL.min} y2={GLUK_MAL.max} fill={F.normal} fillOpacity={0.08} stroke="none" />
              <ReferenceArea y1={2} y2={3.9} fill={F.akutt} fillOpacity={0.08} stroke="none"
                label={{ value: 'hyposone', position: 'insideBottomLeft', fontSize: 10, fill: F.akutt }} />
              <ReferenceArea y1={10} y2={14} fill={F.moderat} fillOpacity={0.08} stroke="none"
                label={{ value: 'hypersone', position: 'insideTopLeft', fontSize: 10, fill: F.moderat }} />
              <ReferenceArea x1="21:12" x2="22:07" fill="#94A3B8" fillOpacity={0.25} stroke="none"
                label={{ value: 'uten kontakt', position: 'insideTop', fontSize: 9, fill: '#475569' }} />
              {markert('glukose') && (
                <ReferenceArea x1={vindu.fra} x2={vindu.til} fill={F.moderat} fillOpacity={0.22} stroke={F.moderat} strokeDasharray="4 3" />
              )}
              <ReferenceLine x="03:12" stroke={F.akutt} strokeWidth={1.4}
                label={{ value: 'kl. 03:12', position: 'top', fontSize: 10, fill: F.akutt }} />
              <Line type="monotone" dataKey="v" name="Glukose" stroke={F.normal} strokeWidth={1.7} dot={false}
                connectNulls={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-2 border-t border-slate-200 pt-2">
          <p className="text-xs font-semibold text-slate-600">Tid i målområde, siste 14 dager</p>
          <div className="mt-1 flex h-4 w-full overflow-hidden border border-slate-300">
            <div style={{ width: `${TID_I_MALOMRADE.under}%`, backgroundColor: F.akutt }} />
            <div style={{ width: `${TID_I_MALOMRADE.i}%`, backgroundColor: F.normal }} />
            <div style={{ width: `${TID_I_MALOMRADE.over}%`, backgroundColor: F.moderat }} />
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 text-xs tabular-nums text-slate-700">
            <span>Under 4,0: {TID_I_MALOMRADE.under} %</span>
            <span>I målområde 4,0–8,0: {TID_I_MALOMRADE.i} %</span>
            <span>Over 8,0: {TID_I_MALOMRADE.over} %</span>
          </div>
        </div>
      </Panel>

      <Panel innerRef={settRef('insulin')} tittel="Insulin" ikon={Syringe} markert={markert('insulin')}
        kilde="Insulinpumpe P-400 · GlukoLink">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={INSULIN_BASAL} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="time" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={20} />
              <YAxis domain={[0, 7]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={26} />
              <Tooltip content={<TT enhet="E" desimaler={2} />} />
              <Bar dataKey="bolus" name="Bolus" fill={F.enhet} isAnimationActive={false} />
              <Line type="stepAfter" dataKey="basal" name="Basal (E/t)" stroke={F.normal} strokeWidth={1.8} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <ul className="mt-2 border-t border-slate-200 pt-2 text-xs">
          {BOLUSER.map((b) => (
            <li key={b.tid} className="flex justify-between gap-2 border-b border-slate-100 py-0.5">
              <span className="tabular-nums text-slate-700">kl. {b.tid} · {b.dose} E</span>
              <span className="text-slate-500">{b.merknad}</span>
            </li>
          ))}
        </ul>
        <div className="mt-2 border border-slate-300 px-2 py-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-700">Pumpestatus: {PUMPESTATUS.tilstand}</span>
            <span className="tabular-nums text-slate-600">Reservoar {PUMPESTATUS.reservoar} %</span>
          </div>
          <div className="mt-1 h-2 w-full border border-slate-300 bg-slate-100">
            <div className="h-full" style={{ width: `${PUMPESTATUS.reservoar}%`, backgroundColor: F.moderat }} />
          </div>
          <p className="mt-1 text-xs text-slate-500">Rekker {PUMPESTATUS.rekkerTil}. {PUMPESTATUS.sisteOkklusjon}.</p>
        </div>
      </Panel>

      <Panel innerRef={settRef('vekt')} tittel="Vekt" ikon={Scale} markert={markert('vekt')} kilde="Vekt NS-9 · NordSensor">
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={VEKT_30D} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="dato" tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} minTickGap={26} />
              <YAxis domain={[90, 96]} tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={34} />
              <Tooltip content={<TT enhet="kg" desimaler={1} />} />
              <Line type="monotone" dataKey="v" name="Vekt" stroke={F.normal} strokeWidth={1.7} dot={false} isAnimationActive={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs tabular-nums text-slate-600">94,2 kg → 91,8 kg på 30 dager (−2,4 kg).</p>
      </Panel>

      <Panel innerRef={settRef('skritt')} tittel="Aktivitet" ikon={Footprints} markert={markert('skritt')}
        kilde="Aktivitetsmåler SV-2 · Stegvis"
        hoyre={<span className="flex items-center gap-1 border border-red-700 bg-red-50 px-1.5 py-0.5 text-xs font-semibold text-red-900"><WifiOff size={12} aria-hidden="true" /> Kilden er nede</span>}>
        <div className="h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={SKRITT_14D} margin={{ top: 6, right: 10, bottom: 0, left: 0 }}>
              <CartesianGrid stroke="#E2E8F0" vertical={false} />
              <XAxis dataKey="dato" tick={{ fontSize: 9, fill: '#475569' }} tickLine={false} axisLine={{ stroke: F.linje }} interval={0} />
              <YAxis tick={akseStil} tickLine={false} axisLine={{ stroke: F.linje }} width={40} />
              <Tooltip content={<TT enhet="skritt" desimaler={0} />} />
              <Bar dataKey="v" name="Skritt" fill={F.enhet} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-slate-600">Siste måling er fra kl. 08:55 i dag. Nye tall kommer når Stegvis er tilbake.</p>
      </Panel>
    </>
  );
}

/* ══════════════════════════════════════════════════════════════════
   UKESRAPPORT (AI) – åpnes først når egen vurdering er registrert
   ══════════════════════════════════════════════════════════════════ */

const VURDERINGSNAVN = { stabil: 'Stabil', folges: 'Bør følges opp', tiltak: 'Krever tiltak' };

function Ukesrapport({ p, vurdering, onVis }) {
  const r = RAPPORT[p.id];
  const f = flaggFor(p.id).slice().sort((a, b) => (a.dato === b.dato ? a.tid.localeCompare(b.tid) : a.dato.localeCompare(b.dato)));
  const ikkeDekket = f.filter((x) => !vurdering.gjennomgatt.includes(x.modul));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-2 border border-slate-400 bg-slate-100 px-3 py-2">
        <Sparkles size={16} className="mt-0.5 shrink-0 text-slate-600" aria-hidden="true" />
        <p className="text-sm text-slate-800">
          AI-en stiller ikke diagnose, gir ingen behandlingsanbefaling og tar ingen beslutninger.
          Den leser måledata opp mot journalens rutiner og peker på tidsvinduer et menneske bør se på.
          Den faglige vurderingen er din.
        </p>
      </div>

      <Panel tittel="Pasientprofil" ikon={Users}
        hoyre={<span className="text-xs tabular-nums text-slate-500">sist oppdatert {PROFIL[p.id].oppdatert}</span>}
        kilde={PROFIL[p.id].kilde}>
        <p className="max-w-3xl text-sm text-slate-700">
          Kort om hvordan {p.navn.split(' ')[0]} har det til vanlig, slik at måledataene under leses i riktig sammenheng.
          Profilen er en sammenstilling av det som allerede er skrevet ned – den tolker ikke og legger ikke til noe nytt.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
          {[['Vaner og døgnrytme', PROFIL[p.id].vaner], ['Faste rutiner', PROFIL[p.id].rutiner]].map(([tittel, punkter]) => (
            <div key={tittel} className="border border-slate-200 px-2 py-2">
              <h4 className="text-xs font-semibold text-slate-600">{tittel}</h4>
              <ul className="mt-1 flex flex-col gap-1.5 text-sm text-slate-800">
                {punkter.map((x, i) => <li key={i} className="border-l-2 border-slate-300 pl-2">{x}</li>)}
              </ul>
            </div>
          ))}
          <div className="border-2 border-slate-800 px-2 py-2">
            <h4 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
              <ShieldCheck size={13} aria-hidden="true" /> Viktig å huske ved tilsyn
            </h4>
            <ul className="mt-1 flex flex-col gap-1.5 text-sm font-medium text-slate-900">
              {PROFIL[p.id].viktig.map((x, i) => <li key={i} className="border-l-2 border-slate-800 pl-2">{x}</li>)}
            </ul>
          </div>
        </div>
      </Panel>

      <Panel tittel="Sammendrag av uken" ikon={FileText} kilde="Måledata fra alle tilkoblede enheter sammenholdt med rutiner i journalen">
        {r.sammendrag.map((avsnitt, i) => (
          <p key={i} className="mb-2 max-w-3xl text-sm leading-relaxed text-slate-800 last:mb-0">{avsnitt}</p>
        ))}
      </Panel>

      <Panel tittel={`Flaggede avvik (${f.length})`} ikon={AlertCircle}
        hoyre={<span className="text-xs text-slate-500">kronologisk</span>}>
        <div className="flex flex-col gap-3">
          {f.map((x) => <Datakort key={x.id} f={x} onVis={onVis} />)}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel tittel="Ikke vurdert av systemet" ikon={AlertTriangle}>
          <p className="text-sm text-slate-700">Dette har AI-en ikke grunnlag for å si noe om:</p>
          <ul className="mt-2 flex flex-col gap-1.5">
            {r.ikkeVurdert.map((x, i) => (
              <li key={i} className="flex gap-2 border-l-2 border-slate-300 pl-2 text-sm text-slate-800">{x}</li>
            ))}
          </ul>
        </Panel>

        <Panel tittel="Din vurdering mot det AI-en flagget" ikon={ClipboardList}>
          <div className="border border-slate-300 px-2 py-1.5">
            <p className="text-xs text-slate-500">Registrert av {vurdering.av} · {vurdering.tid}</p>
            <p className="text-sm font-semibold text-slate-900">{VURDERINGSNAVN[vurdering.status]}</p>
            <p className="text-xs text-slate-600">
              Gjennomgått: {vurdering.gjennomgatt.length ? vurdering.gjennomgatt.map((m) => MODULNAVN[m]).join(', ') : 'ingen moduler huket av'}
            </p>
            {vurdering.notat && <p className="mt-1 text-sm text-slate-800">«{vurdering.notat}»</p>}
          </div>

          <ul className="mt-2 flex flex-col gap-1">
            {f.map((x) => {
              const dekket = vurdering.gjennomgatt.includes(x.modul);
              return (
                <li key={x.id} className={`flex flex-wrap items-center gap-2 border px-2 py-1.5 text-sm ${dekket ? 'border-slate-200' : 'border-amber-700 bg-amber-50'}`}>
                  <span aria-hidden="true" style={{ color: NIVA[x.niva].hex }}>{NIVA[x.niva].glyph}</span>
                  <span className="text-slate-900">{x.tittel}</span>
                  <span className="ml-auto text-xs text-slate-600">
                    {dekket ? `Innenfor ${MODULNAVN[x.modul].toLowerCase()}, som du gikk gjennom` : `Ikke nevnt i din vurdering (${MODULNAVN[x.modul].toLowerCase()})`}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-2 border-l-2 border-amber-700 bg-amber-50 px-2 py-1.5 text-sm text-slate-800">
            {ikkeDekket.length > 0
              ? `${ikkeDekket.length} av ${f.length} punkter ligger i moduler du ikke huket av i vurderingen.`
              : 'Du gikk gjennom alle modulene AI-en har flagget punkter i.'}
            {p.id === 'ingrid'
              ? ' Kveldsblodtrykket har steget jevnt i 14 dager uten at noen enkeltmåling var høy nok til å utløse varsel. Det står ikke i varselstrømmen, og er den typen moderate avvik dette laget er bygget for å fange.'
              : ' Fallet i tid i målområde utløste aldri et varsel, og kommer bare fram når døgnene ses samlet.'}
          </p>
        </Panel>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PASIENTSIDE
   ══════════════════════════════════════════════════════════════════ */

function Pasientside({ p, fane, setFane, vurdering, onLagreVurdering, vindu, setVindu, onVis, overstyrt, setOverstyrt, rolig, onApne }) {
  const refs = useRef({});
  const vurderingRef = useRef(null);
  const [fremhev, setFremhev] = useState(false);
  const settRef = (id) => (el) => { refs.current[id] = el; };
  const laast = !vurdering;

  useEffect(() => {
    if (vindu && fane === 'maledata') {
      const el = refs.current[vindu.modul];
      if (el) el.scrollIntoView({ behavior: rolig ? 'auto' : 'smooth', block: 'center' });
    }
  }, [vindu, fane, rolig]);

  useEffect(() => {
    if (!fremhev) return undefined;
    const t = setTimeout(() => setFremhev(false), 2600);
    return () => clearTimeout(t);
  }, [fremhev]);

  const tabKlasse = (aktiv) =>
    `border-b-2 px-3 py-2 text-sm ${fokusring} ${aktiv ? 'border-slate-800 font-semibold text-slate-900' : 'border-transparent text-slate-600 hover:text-slate-900'}`;

  return (
    <div className="flex flex-col gap-3">
      <section className="border border-slate-300 bg-white">
        <div className="flex flex-wrap items-start gap-x-4 gap-y-2 px-3 py-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{p.navn}</h2>
            <p className="text-sm text-slate-600">{p.alder} år · {p.adresse} · {p.distrikt}</p>
          </div>
          <div className="flex flex-col gap-1">
            <Merke niva={p.status} />
            <span className="text-xs tabular-nums text-slate-500">Sist synkronisert {DEMO_DATO} kl. {DEMO_KLOKKE}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {p.enheter.map((e) => (
              <span key={e} className="flex items-center gap-1 border border-teal-700 bg-teal-50 px-1.5 py-0.5 text-xs text-teal-900">
                <Wifi size={11} aria-hidden="true" />{e}
              </span>
            ))}
          </div>
          <div className="ml-auto text-right text-xs text-slate-600">
            <div>Neste planlagte tilsyn</div>
            <div className="font-semibold text-slate-900">{p.nesteTilsyn}</div>
          </div>
        </div>

        {p.full && (
          <div className="flex items-center gap-1 border-t border-slate-200 px-3">
            <button className={tabKlasse(fane === 'maledata')} onClick={() => setFane('maledata')}>Måledata</button>
            <button className={tabKlasse(fane === 'rapport' && !laast)}
              onClick={() => {
                if (laast) {
                  setFremhev(true);
                  vurderingRef.current?.scrollIntoView({ behavior: rolig ? 'auto' : 'smooth', block: 'center' });
                } else setFane('rapport');
              }}
              aria-disabled={laast}>
              <span className="flex items-center gap-1">
                {laast && <Lock size={13} aria-hidden="true" />} Ukesrapport (AI)
              </span>
            </button>
            {laast && (
              <span className="ml-2 text-xs text-slate-600">
                Åpnes når du har registrert din egen vurdering – dataene skal leses uavhengig først.
              </span>
            )}
          </div>
        )}
      </section>

      {!p.full ? (
        <Panel tittel="Måledata">
          <div className="flex flex-col items-start gap-2 border border-dashed border-slate-300 px-4 py-8">
            <p className="text-sm font-medium text-slate-800">Denne pasienten er ikke del av demodatasettet.</p>
            <p className="text-sm text-slate-600">
              Ingrid Bakke og Odd Martin Nilsen har fullstendige måleserier, ukesrapport og datakort.
            </p>
            <div className="mt-1 flex gap-2">
              <button onClick={() => onApne('ingrid')} className={`border border-slate-800 bg-slate-800 px-2 py-1 text-xs font-semibold text-white hover:bg-slate-700 ${fokusring}`}>
                Åpne Ingrid Bakke
              </button>
              <button onClick={() => onApne('oddmartin')} className={`border border-slate-400 px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-100 ${fokusring}`}>
                Åpne Odd Martin Nilsen
              </button>
            </div>
          </div>
        </Panel>
      ) : fane === 'maledata' ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          <EgenVurdering p={p} vurdering={vurdering} onLagre={onLagreVurdering} innerRef={vurderingRef} fremhevet={fremhev} />
          <Besoksfrekvens p={p} overstyrt={overstyrt} setOverstyrt={setOverstyrt} />
          {p.id === 'ingrid'
            ? <ModulerIngrid settRef={settRef} vindu={vindu} onFjern={() => setVindu(null)} />
            : <ModulerOdd settRef={settRef} vindu={vindu} onFjern={() => setVindu(null)} />}
          <Journalutdrag j={p.id === 'ingrid' ? JOURNAL_INGRID : JOURNAL_ODD} />
        </div>
      ) : (
        <Ukesrapport p={p} vurdering={vurdering} onVis={onVis} />
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ROT
   ══════════════════════════════════════════════════════════════════ */

export default function HelseplattformDemo() {
  const [side, setSide] = useState('oversikt');
  const [pid, setPid] = useState(null);
  const [fane, setFane] = useState('maledata');
  const [distrikt, setDistrikt] = useState('alle');
  const [niva, setNiva] = useState('alle');
  const [kvitteringer, setKvitteringer] = useState({});
  const [vurderinger, setVurderinger] = useState({});
  const [overstyrt, setOverstyrt] = useState({});
  const [vindu, setVindu] = useState(null);
  const [modal, setModal] = useState(null);
  const [rolig, setRolig] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setRolig(mq.matches);
    const h = (e) => setRolig(e.matches);
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);

  useEffect(() => {
    if (!modal) return undefined;
    const h = (e) => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modal]);

  const naa = () => {
    const d = new Date();
    const to = (n) => String(n).padStart(2, '0');
    return `${to(d.getDate())}.${to(d.getMonth() + 1)} kl. ${to(d.getHours())}:${to(d.getMinutes())}`;
  };

  const apnePasient = (id) => {
    setPid(id); setSide('pasient'); setFane('maledata'); setVindu(null); setModal(null);
    window.scrollTo({ top: 0, behavior: 'auto' });
  };

  const visIMaledata = (f) => {
    setPid(f.pid); setSide('pasient'); setFane('maledata'); setVindu(f.vindu); setModal(null);
  };

  const kvitter = (id) =>
    setKvitteringer((k) => ({ ...k, [id]: { av: `${INNLOGGET.navn} (${INNLOGGET.rolle.split(',')[0].toLowerCase()})`, tid: naa() } }));

  const lagreVurdering = (v) =>
    setVurderinger((x) => ({ ...x, [pid]: { ...v, av: INNLOGGET.navn, tid: naa() } }));

  const p = pid ? pasient(pid) : null;
  const tittel = side === 'oversikt' ? 'Oversikt' : side === 'sok' ? 'Pasientsøk' : p.navn;

  return (
    <div className="flex min-h-screen w-full bg-slate-200 text-slate-900">
      <Sidemeny side={side} gaTil={(s) => { setSide(s); setPid(null); }}
        distrikt={distrikt} setDistrikt={setDistrikt} niva={niva} setNiva={setNiva}
        tilkoblede={DATAKILDER.filter((k) => k.status === 'tilkoblet').length} />

      <main className="min-w-0 flex-1">
        <Topplinje tittel={tittel}
          tilbake={side === 'pasient' ? 'Tilbake til oversikt' : null}
          onTilbake={() => { setSide('oversikt'); setPid(null); }} />

        <div className="p-3">
          {side === 'oversikt' && (
            <Oversikt distrikt={distrikt} niva={niva} kvitteringer={kvitteringer}
              onKvitter={kvitter} onApne={apnePasient} onDatakort={(id) => setModal(id)} rolig={rolig} />
          )}
          {side === 'sok' && <Pasientsok distrikt={distrikt} niva={niva} onApne={apnePasient} />}
          {side === 'pasient' && p && (
            <Pasientside key={p.id} p={p} fane={fane} setFane={setFane}
              vurdering={vurderinger[p.id]} onLagreVurdering={lagreVurdering}
              vindu={vindu} setVindu={setVindu} onVis={visIMaledata}
              overstyrt={overstyrt[p.id] ?? null} setOverstyrt={(n) => setOverstyrt((o) => ({ ...o, [p.id]: n }))}
              rolig={rolig} onApne={apnePasient} />
          )}
        </div>

        <footer className="border-t border-slate-300 px-4 py-3 text-xs text-slate-600">
          Demodata – fiktive pasienter. Alle måleserier, navn, leverandører og journalutdrag er syntetiske og laget for demonstrasjon.
        </footer>
      </main>

      {modal && (
        <div className="fixed inset-0 z-50 overflow-y-auto p-4" style={{ backgroundColor: 'rgba(15,23,42,0.6)' }}
          role="dialog" aria-modal="true" aria-label="Datakort for varsel"
          onClick={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
          <div className="mx-auto w-full max-w-5xl">
            <div className="mb-2 flex items-center justify-between">
              <span className="border border-white bg-slate-900 px-2 py-1 text-xs font-semibold text-white">
                Etterprøv varselet
              </span>
              <button onClick={() => setModal(null)}
                className={`flex items-center gap-1 border border-white bg-white px-2 py-1 text-xs font-semibold text-slate-900 ${fokusring}`}>
                <X size={13} aria-hidden="true" /> Lukk
              </button>
            </div>
            <Datakort f={flagg(modal)} onVis={visIMaledata} />
          </div>
        </div>
      )}
    </div>
  );
}

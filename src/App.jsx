import { useState, useEffect, useRef } from 'react'
import { kvGet, kvSet, kvSubscribe } from './supabase.js'
import { getCurrentUser, setCurrentUser, clearCurrentUser } from './identity.js'
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// ─── Trip constants ────────────────────────────────────────────────────────
const TRIP = {
  pnr: '1NLCW9',
  group: 8,
  departure: { date: '29 juil 2026', flights: ['PC956 GVA→SAW 17h20', 'PC702 SAW→BSZ 23h05'] },
  returnFlight: { date: '14 août 2026', flights: ['PC703 BSZ→SAW 08h20', 'PC955 SAW→GVA 14h05'] },
  members: [
    { name: 'Clara Ka' },
    { name: 'Henri Blln' },
    { name: 'Mael Demmerle' },
    { name: 'Maëlle Guegaden' },
    { name: 'Nathan Rougier' },
    { name: 'Remy Launois' },
    { name: 'Thibault Azemar' },
    { name: 'Thomas Mestrou' },
  ],
  tricount: 'https://tricount.com/tAvBEZtPaFwCGOVPmZ',
  drive: 'https://drive.google.com/drive/folders/1EYBsgJAOiabYTCtLQQ1D0zBIisESeV36?usp=sharing',
  miro: 'https://miro.com/welcomeonboard/cFBSTGdYczZjNS9QQ1NOL3FlbnRnYkN6UlZ0S1dqaWZxTUovUHhCaUwrM3liYnpFcExtWUZhTmhtUndnVC80QU5UbkVoU0lUMnQrSFRDWHpremtFVC92ZU1iSXRQVlI4Q2FWKzYvQ1dWbGM3bk53b1lNaTRjNDZNZGk2SW5zRlBBS2NFMDFkcUNFSnM0d3FEN050ekl3PT0hdjE=?share_link_id=438974220017',
  discord: 'https://discord.gg/eGspcXmcD8',
  whatsapp: 'https://chat.whatsapp.com/HePOoUv1nI861BgvWv3k4C',
  horseAgency: 'Tatosh',
}

const AGENCIES = [
  { id: 'tatosh', name: 'Tatosh', url: 'https://gtla.net/rando-cheval-song-kul/', note: '4j/3n · 200€/p · ✅ CHOISI PAR LE GROUPE', chosen: true, contact: 'Henri Blln' },
  { id: 'visitalay', name: 'Visit Alay', url: 'https://visitalay.com/tour/song-kol-horse-trek-adventure/', note: '5j/4n · 730€/p · Non retenu', chosen: false },
]

// ─── Map waypoints (defaults) ────────────────────────────────────────────
const DEFAULT_MAP_POINTS = [
  { id: 1, name: 'Bichkek', lat: 42.8746, lng: 74.5698, phase: 'city', day: 1, desc: 'Arrivée, Halo Hostel' },
  { id: 2, name: 'Kyzart', lat: 42.26, lng: 75.56, phase: 'horse', day: 2, desc: 'Arrivée en 4x4 à midi' },
  { id: 3, name: 'Kilemche', lat: 42.05, lng: 75.35, phase: 'horse', day: 2, desc: '3h à cheval → camp Kilemche' },
  { id: 4, name: 'Lac Song-Köl', lat: 41.84, lng: 75.15, phase: 'horse', day: 3, desc: '3h à cheval → lac Song-Köl' },
  { id: 5, name: 'Song-Köl · Kyrjol', lat: 41.80, lng: 75.25, phase: 'horse', day: 4, desc: 'Camp Tuz Ashuu → Camp Kyrjol, bord du lac' },
  { id: 6, name: 'Kyzart (retour)', lat: 42.26, lng: 75.56, phase: 'horse', day: 5, desc: '3h à cheval, déjeuner à Kyzart' },
]

const PHASE_COLORS = { city: '#9c78cd', horse: '#c4956a', '4x4': '#5b9bd5', return: '#9c78cd' }

function sortPoints(pts) {
  return [...pts].sort((a, b) => a.day - b.day || a.id - b.id)
}

function getPointLabel(point, allPoints) {
  const sameDay = allPoints.filter(p => p.day === point.day)
  if (sameDay.length === 1) return `J${point.day}`
  const sorted = sameDay.sort((a, b) => a.id - b.id)
  const idx = sorted.findIndex(p => p.id === point.id) + 1
  return `J${point.day}.${idx}`
}

// ─── Build 16 days Jul 30 → Aug 14 ────────────────────────────────────────
// J1 = Bichkek city, J2-J5 = horse, J6-J15 = 4x4, J16 = return flight
function buildDays() {
  const mo = ['jan','fév','mar','avr','mai','jun','jul','aoû','sep','oct','nov','déc']
  const dn = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam']
  return Array.from({ length: 16 }, (_, i) => {
    const d = new Date(2026, 6, 30)
    d.setDate(d.getDate() + i)
    return {
      num: i + 1,
      dateStr: `${dn[d.getDay()]} ${d.getDate()} ${mo[d.getMonth()]}`,
      phase: i === 0 ? 'city' : i === 15 ? 'return' : i < 5 ? 'horse' : '4x4',
      isArrival: i === 0,
      isDeparture: i === 15,
    }
  })
}
const DAYS = buildDays()

function emptyDay(day) {
  if (day.phase === 'city') return { location: 'Bichkek', activity: '', accommodation: 'Halo Hostel', notes: '', confirmed: false }
  if (day.phase === 'return') return { location: 'Bichkek', activity: 'Vol PC703 08h20 → Istanbul → Genève 16h20', accommodation: 'Aéroport Manas', notes: '', confirmed: false }
  if (day.phase === 'horse') return { location: '', activity: '', accommodation: 'Yourte', circuit: '', notes: '', confirmed: false }
  return { location: '', activity: '', accommodation: '', transport: '4×4', route: '', notes: '', confirmed: false }
}

const DEFAULT_CHECKLIST_CATS = [
  { id: 'Vêtements', icon: '👕' },
  { id: 'Campement', icon: '⛺' },
  { id: 'Équipement', icon: '🎒' },
  { id: 'Documents', icon: '📄' },
]
const DEFAULT_CHECKLIST = {
  items: [
    { id: 1, text: 'Sous-vêtements mérinos (2-3)', cat: 'Vêtements' },
    { id: 2, text: 'Haut thermique (mérinos)', cat: 'Vêtements' },
    { id: 3, text: 'Bas thermique (mérinos)', cat: 'Vêtements' },
    { id: 4, text: 'Chaussettes mérinos (2-3)', cat: 'Vêtements' },
    { id: 5, text: 'T-shirt mérinos', cat: 'Vêtements' },
    { id: 6, text: 'Polaire', cat: 'Vêtements' },
    { id: 7, text: 'Pantalon rando / short', cat: 'Vêtements' },
    { id: 8, text: 'Doudoune', cat: 'Vêtements' },
    { id: 9, text: 'Veste de pluie coupe-vent', cat: 'Vêtements' },
    { id: 10, text: 'Chaussures de rando', cat: 'Vêtements' },
    { id: 11, text: 'Claquettes', cat: 'Vêtements' },
    { id: 12, text: 'Gants', cat: 'Vêtements' },
    { id: 13, text: 'Bonnet', cat: 'Vêtements' },
    { id: 14, text: 'Tour de cou', cat: 'Vêtements' },
    { id: 15, text: 'Tente', cat: 'Campement' },
    { id: 16, text: 'Duvet (confort 0°C minimum)', cat: 'Campement' },
    { id: 17, text: 'Matelas (R-value 3 minimum)', cat: 'Campement' },
    { id: 18, text: 'Oreiller', cat: 'Campement' },
    { id: 19, text: 'Kit réchaud popote léger', cat: 'Campement' },
    { id: 20, text: 'Sac à dos de randonnée', cat: 'Équipement' },
    { id: 21, text: 'Bâtons (fortement conseillé)', cat: 'Équipement' },
    { id: 22, text: 'Sacs de rangement étanches', cat: 'Équipement' },
    { id: 23, text: 'Lunettes de soleil', cat: 'Équipement' },
    { id: 24, text: 'Casquette / chapeau', cat: 'Équipement' },
    { id: 25, text: 'Crème solaire', cat: 'Équipement' },
    { id: 26, text: 'Trousse de secours', cat: 'Équipement' },
    { id: 27, text: 'Couverture de survie', cat: 'Équipement' },
    { id: 28, text: 'Gourde filtrante', cat: 'Équipement' },
    { id: 29, text: 'Camelback 2L minimum', cat: 'Équipement' },
    { id: 30, text: 'Couverts (pas en plastique)', cat: 'Équipement' },
    { id: 31, text: 'Couteau', cat: 'Équipement' },
    { id: 32, text: 'Visa électronique (e-visa)', cat: 'Documents' },
    { id: 33, text: 'Passeport valide 6 mois après retour', cat: 'Documents' },
    { id: 34, text: 'Assurance voyage / rapatriement', cat: 'Documents' },
    { id: 35, text: 'Copie passeport + billets (papier & numérique)', cat: 'Documents' },
    { id: 36, text: 'Cash euros + dollars (change sur place)', cat: 'Documents' },
  ],
  checked: Object.fromEntries(TRIP.members.map(m => [m.name, []])),
}

function syncMapToItinerary(points, currentItinerary) {
  const updated = { ...currentItinerary }
  const dayGroups = {}
  points.forEach(p => {
    if (!dayGroups[p.day]) dayGroups[p.day] = []
    dayGroups[p.day].push(p.name)
  })
  for (const [day, names] of Object.entries(dayGroups)) {
    const dayNum = Number(day)
    const dayDef = DAYS[dayNum - 1]
    if (!dayDef) continue
    const current = updated[dayNum] || emptyDay(dayDef)
    updated[dayNum] = { ...current, location: names.join(' → ') }
  }
  return updated
}

// ─── Claude system prompt ──────────────────────────────────────────────────
const SYSTEM = `Tu es un expert en voyages au Kirghizistan. Aide un groupe de 8 amis à planifier leur voyage.

VOYAGE :
- Groupe : 8 personnes, vols Pegasus PNR 1NLCW9
- Arrivée Bichkek : 30 juillet 2026 à 07h00
- Départ : 14 août 2026 à 08h20
- 15 nuits sur place
- J1 (30 juil) : arrivée à BICHKEK, découverte de la capitale, hôtel
- Phase équestre (J2–J5, 31 juil–3 août) : randonnée ÉQUESTRE, nuits en YOURTE, agence CHOISIE : TATOSH (4j/3n, 200€/p)
- Phase 4×4 (J6–J15, 4–13 août) : 4×4, EST du Kirghizistan, Issyk-Koul, Karakol, Djety-Oguz etc.
- J16 (14 août) : RETOUR, vol PC703 Bichkek 08h20 → Istanbul → Genève 16h20

Réponds en français, de façon concrète et précise. Utilise des listes. Pense à la logistique pour 8 personnes.`

// ─── Styles ────────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,600;0,700;1,600&family=DM+Sans:wght@300;400;500&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  :root{
    --bg:#192e23;--bg2:#213529;--bg3:#2a4235;--bg4:#314e40;
    --amber:#d4921c;--amberl:#e8ad3f;--amberd:rgba(212,146,28,.14);
    --horse:#9b6534;--horsel:#d4945a;--horsed:rgba(155,101,52,.14);
    --lake:#2d5f8a;--lakel:#5a9fcc;--laked:rgba(45,95,138,.14);
    --city:#5a3e8a;--cityl:#9b78d4;--cityd:rgba(90,62,138,.14);
    --bone:#f0e8d5;--bone2:#d8ccb4;--muted:#5c7a68;--green:#4caf7a;
    --red:#c0391b;--border:rgba(240,232,213,.1);
  }
  html,body{font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--bone);min-height:100vh}
  .wrap{max-width:980px;margin:0 auto;padding:0 1.1rem 5rem}

  .hdr{padding:2rem 0 1.4rem;border-bottom:1px solid var(--border);margin-bottom:1.6rem}
  .hdr-row{display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:.8rem}
  .title{font-family:'Playfair Display',serif;font-size:clamp(1.8rem,4.5vw,3rem);font-weight:700;line-height:1;color:var(--bone)}
  .title em{color:var(--amber);font-style:italic}
  .badges{display:flex;gap:.4rem;flex-wrap:wrap;margin-top:.5rem}
  .bdg{font-size:.68rem;font-weight:500;letter-spacing:.09em;text-transform:uppercase;padding:.28rem .6rem;border-radius:2px}
  .bdg-a{background:var(--amber);color:var(--bg)}
  .bdg-o{border:1px solid var(--border);color:var(--muted)}
  .bdg-h{background:var(--horsed);color:var(--horsel);border:1px solid rgba(155,101,52,.28)}
  .bdg-l{background:var(--laked);color:var(--lakel);border:1px solid rgba(45,95,138,.28)}
  .bdg-g{background:rgba(76,175,122,.12);color:var(--green);border:1px solid rgba(76,175,122,.25)}

  .tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:1.8rem;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch}
  .tab{padding:.6rem 1.1rem;font-size:.79rem;font-weight:500;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;border-bottom:2px solid transparent;color:var(--muted);transition:all .15s;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif;white-space:nowrap}
  .tab:hover{color:var(--bone)}
  .tab.on{color:var(--amber);border-bottom-color:var(--amber)}
  @media(max-width:500px){
    .tab{padding:.5rem .65rem;font-size:.7rem;letter-spacing:.04em}
  }

  .slbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.13em;color:var(--amber);margin-bottom:.7rem}

  /* Two-col layout */
  .layout{display:grid;grid-template-columns:200px 1fr;gap:1rem;align-items:start}
  @media(max-width:620px){.layout{grid-template-columns:1fr}}

  /* Day sidebar */
  .day-list{display:flex;flex-direction:column;gap:.3rem;position:sticky;top:1rem;max-height:90vh;overflow-y:auto}
  .day-item{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.5rem .65rem;cursor:pointer;transition:all .15s;border-left:3px solid transparent}
  .day-item:hover{border-color:var(--amber)}
  .day-item.on{border-color:var(--amber);background:var(--amberd)}
  .day-item.horse{border-left-color:var(--horse)}
  .day-item.x4{border-left-color:var(--lake)}
  .day-item.cap{border-left-color:var(--city)}
  .day-item.on.horse{border-color:var(--horse);background:var(--horsed)}
  .day-item.on.x4{border-color:var(--lake);background:var(--laked)}
  .day-item.on.cap{border-color:var(--city);background:var(--cityd)}
  .di-num{font-family:'Playfair Display',serif;font-size:.95rem;color:var(--amber);line-height:1}
  .di-date{font-size:.62rem;color:var(--muted);margin-top:.1rem}
  .di-loc{font-size:.67rem;color:var(--bone);margin-top:.12rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:130px}
  .phase-sep{font-size:.62rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);padding:.5rem .2rem .3rem;display:flex;align-items:center;gap:.4rem}
  .phase-sep::after{content:'';flex:1;height:1px;background:var(--border)}
  @media(max-width:620px){
    .day-list{position:static;flex-direction:row;overflow-x:auto;overflow-y:hidden;max-height:none;gap:.35rem;padding-bottom:.5rem;-webkit-overflow-scrolling:touch;scroll-snap-type:x mandatory}
    .day-item{min-width:70px;flex-shrink:0;border-left:none;border-top:3px solid transparent;padding:.4rem .5rem;scroll-snap-align:start}
    .day-item.horse{border-left-color:transparent;border-top-color:var(--horse)}
    .day-item.x4{border-left-color:transparent;border-top-color:var(--lake)}
    .day-item.cap{border-left-color:transparent;border-top-color:var(--city)}
    .di-loc{max-width:60px;font-size:.58rem}
    .phase-sep{writing-mode:horizontal-tb;padding:.2rem .4rem;min-width:max-content;flex-shrink:0;align-self:center}
    .phase-sep::after{display:none}
  }

  /* Day editor */
  .day-editor{background:var(--bg2);border:1px solid var(--border);border-radius:4px;overflow:hidden}
  .de-header{padding:1rem 1.2rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem}
  .de-title{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--bone)}
  .de-sub{font-size:.73rem;color:var(--muted);margin-top:.1rem}
  .de-body{padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.85rem}
  @media(max-width:500px){
    .de-header{padding:.75rem .8rem}
    .de-title{font-size:.95rem}
    .de-sub{font-size:.66rem}
    .de-body{padding:.8rem}
    .de-footer{padding:.6rem .8rem}
    .ai-toggle{font-size:.7rem;padding:.4rem .6rem}
  }
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
  @media(max-width:500px){.field-row{grid-template-columns:1fr}}
  .field{display:flex;flex-direction:column;gap:.3rem}
  .field label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
  .field input,.field textarea{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.55rem .75rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.84rem;outline:none;transition:border-color .15s;width:100%}
  .field input:focus,.field textarea:focus{border-color:var(--amber)}
  .field input::placeholder,.field textarea::placeholder{color:var(--muted)}
  .field textarea{resize:vertical;min-height:72px}
  .de-footer{padding:.8rem 1.2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap}
  .confirm-row{display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.8rem;color:var(--muted)}
  .confirm-row input{accent-color:var(--green)}
  .confirm-row.checked{color:var(--green)}
  .save-btn{padding:.5rem 1rem;background:var(--amber);color:var(--bg);border:none;border-radius:3px;font-size:.82rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
  .save-btn:hover:not(:disabled){background:var(--amberl)}
  .save-btn:disabled{opacity:.5;cursor:not-allowed}
  .saved-flash{font-size:.72rem;color:var(--green);animation:fadeOut 2s forwards}
  @keyframes fadeOut{0%,60%{opacity:1}100%{opacity:0}}

  /* AI panel */
  .ai-toggle{padding:.5rem .85rem;border:1px solid var(--amberd);border-radius:3px;background:transparent;color:var(--amberl);font-size:.76rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
  .ai-toggle:hover{background:var(--amberd)}
  .ai-panel{background:var(--bg3);border-top:1px solid var(--border);padding:1rem 1.2rem}
  .ai-panel-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--amber);margin-bottom:.6rem}
  .ai-q-row{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem}
  .ai-qbtn{padding:.28rem .65rem;border:1px solid rgba(212,146,28,.22);border-radius:2px;background:transparent;color:var(--amberl);font-size:.7rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
  .ai-qbtn:hover{background:var(--amberd)}
  .ai-input-row{display:flex;gap:.4rem}
  .ai-input{flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.5rem .75rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.82rem;outline:none;min-width:0}
  .ai-input:focus{border-color:var(--amber)}
  .ai-input::placeholder{color:var(--muted)}
  .ai-send{padding:.5rem .85rem;background:var(--amber);color:var(--bg);border:none;border-radius:3px;font-size:.8rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif}
  .ai-send:disabled{opacity:.5;cursor:not-allowed}
  @media(max-width:500px){
    .ai-panel{padding:.75rem .8rem}
    .ai-qbtn{font-size:.65rem;padding:.22rem .5rem}
  }
  .ai-answer{margin-top:.75rem;background:rgba(255,255,255,.04);border:1px solid rgba(212,146,28,.16);border-radius:3px;padding:.8rem 1rem;font-size:.82rem;line-height:1.65;color:var(--bone);white-space:pre-wrap}
  .typing{display:flex;gap:4px;padding:.3rem 0}
  .typing span{width:6px;height:6px;border-radius:50%;background:var(--amber);animation:bounce 1.2s ease-in-out infinite}
  .typing span:nth-child(2){animation-delay:.2s}
  .typing span:nth-child(3){animation-delay:.4s}

  /* Overview */
  .flight-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.8rem 1rem;margin-bottom:.4rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
  .f-num{font-family:'Playfair Display',serif;color:var(--amber);font-size:.9rem;min-width:50px}
  .f-txt{font-size:.82rem;color:var(--bone)}
  .f-dir{font-size:.66rem;padding:.16rem .5rem;border-radius:2px;text-transform:uppercase;letter-spacing:.07em;font-weight:500}
  @media(max-width:500px){
    .flight-card{padding:.6rem .75rem;gap:.5rem}
    .f-num{min-width:auto;font-size:.82rem}
    .f-txt{font-size:.75rem}
  }
  .f-out{background:var(--amberd);color:var(--amberl)}
  .f-in{background:rgba(192,57,27,.1);color:#e07050}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:3px;overflow:hidden;margin:1.4rem 0}
  .stat{background:var(--bg2);padding:.9rem;text-align:center}
  .stat-n{font-family:'Playfair Display',serif;font-size:1.7rem;color:var(--amber);font-weight:700;line-height:1}
  .stat-l{font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-top:.28rem}
  @media(max-width:500px){
    .stats{grid-template-columns:repeat(2,1fr)}
    .stat{padding:.7rem .5rem}
    .stat-n{font-size:1.3rem}
  }

  /* Progress */
  .progress-row{display:flex;gap:.5rem;margin:1rem 0;flex-wrap:wrap}
  .prog-cell{flex:1;min-width:24px;height:8px;border-radius:2px;background:var(--bg3)}
  .prog-cell.done-horse{background:var(--horse)}
  .prog-cell.done-4x4{background:var(--lake)}
  .prog-cell.done-city{background:var(--city)}

  /* Agencies */
  .ag-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:1rem;margin-bottom:.6rem}
  .ag-name{font-family:'Playfair Display',serif;font-size:1rem;margin-bottom:.2rem}
  .ag-note{font-size:.78rem;color:var(--muted)}
  .ag-url{font-size:.72rem;color:var(--amber);text-decoration:none;display:inline-block;margin-top:.4rem}
  .ag-url:hover{text-decoration:underline}

  /* Contacts */
  .contacts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.5rem;margin-top:.8rem}
  @media(max-width:500px){
    .contacts-grid{grid-template-columns:1fr}
  }
  .contact-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.9rem 1rem;display:grid;grid-template-columns:1fr auto;gap:.3rem .8rem;align-items:start;cursor:pointer;transition:border-color .15s}
  .contact-card:hover{border-color:var(--amber)}
  .contact-name{font-family:'Playfair Display',serif;font-size:.98rem;color:var(--bone);grid-column:1}
  .contact-info{font-size:.79rem;color:var(--muted);grid-column:1;display:flex;flex-direction:column;gap:.18rem;margin-top:.35rem}
  .contact-info a{color:var(--lakel);text-decoration:none}
  .contact-info a:hover{text-decoration:underline}
  .contact-empty{font-size:.72rem;color:rgba(92,122,104,.5);font-style:italic}
  .contact-idx{font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--amber);opacity:.35;grid-column:2;grid-row:1/3;align-self:center}

  /* Notes */
  .notes-panel{background:var(--bg2);border:1px solid var(--border);border-radius:3px;overflow:hidden}
  .np-header{padding:.8rem 1rem;background:rgba(212,146,28,.07);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
  .np-title{font-family:'Playfair Display',serif;font-size:.95rem}
  .live{display:flex;align-items:center;gap:.3rem;font-size:.67rem;color:var(--green)}
  .ldot{width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
  .np-list{padding:.8rem 1rem;min-height:80px;max-height:340px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem}
  .note{background:var(--bg3);border-radius:3px;padding:.55rem .75rem}
  .note-meta{font-size:.65rem;color:var(--muted);display:flex;justify-content:space-between;margin-bottom:.2rem}
  .note-txt{font-size:.82rem;line-height:1.55;white-space:pre-wrap}
  .np-input{display:flex;gap:.4rem;padding:.7rem 1rem;border-top:1px solid var(--border)}
  .ni-name{width:100px;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.48rem .65rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.8rem;outline:none}
  .ni-name:focus{border-color:var(--amber)}
  .ni-text{flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.48rem .7rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.8rem;outline:none;resize:none}
  .ni-text:focus{border-color:var(--amber)}
  .ni-name::placeholder,.ni-text::placeholder{color:var(--muted)}
  .ni-btn{padding:.48rem .85rem;background:var(--amber);color:var(--bg);border:none;border-radius:3px;font-size:.8rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif}
  .ni-btn:disabled{opacity:.4;cursor:not-allowed}
  @media(max-width:500px){
    .np-input{flex-wrap:wrap}
    .ni-name{width:100%}
    .ni-text{width:100%;min-width:0}
    .ni-btn{width:100%}
  }

  /* Quick links */
  .quicklinks{display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:1.2rem}
  .qlink{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.8rem 1rem;text-decoration:none;display:flex;align-items:center;gap:.6rem;transition:border-color .15s}
  .qlink:hover{border-color:var(--amber)}
  .qlink-icon{font-size:1.2rem}
  .qlink-label{font-size:.82rem;color:var(--bone);font-weight:500}
  .qlink-sub{font-size:.7rem;color:var(--muted)}
  @media(max-width:500px){
    .quicklinks{grid-template-columns:1fr}
    .qlink{padding:.6rem .8rem}
  }

  /* Countdown */
  .countdown{margin-top:.7rem;background:var(--amberd);border:1px solid rgba(212,146,28,.2);border-radius:4px;padding:.6rem .8rem;display:inline-block}
  .cd-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--amberl);margin-bottom:.4rem}
  .cd-boxes{display:flex;align-items:center;gap:.3rem}
  .cd-box{display:flex;flex-direction:column;align-items:center;min-width:38px}
  .cd-num{font-family:'Playfair Display',serif;font-size:1.4rem;font-weight:700;color:var(--amber);line-height:1;font-variant-numeric:tabular-nums}
  .cd-unit{font-size:.55rem;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-top:.15rem}
  .cd-sep{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--muted);font-weight:700;align-self:flex-start;margin-top:.1rem}
  @media(max-width:500px){
    .countdown{display:block}
    .cd-num{font-size:1.15rem}
    .cd-box{min-width:32px}
  }

  /* Header bottom row: countdown + quick links */
  .hdr-bottom{display:flex;align-items:stretch;gap:.6rem;margin-top:.7rem;flex-wrap:wrap}
  .hdr-links{display:grid;grid-template-columns:1fr 1fr;gap:.4rem;flex:1;min-width:200px}
  .hdr-link{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.5rem .7rem;text-decoration:none;display:flex;align-items:center;gap:.5rem;transition:border-color .15s}
  .hdr-link:hover{border-color:var(--amber)}
  .hl-icon{font-size:1rem;flex-shrink:0}
  .hl-label{font-size:.78rem;color:var(--bone);font-weight:500;line-height:1.2}
  .hl-sub{font-size:.64rem;color:var(--muted);line-height:1.2}
  @media(max-width:620px){
    .hdr-bottom{flex-direction:column}
    .hdr-links{min-width:0}
  }
  @media(max-width:500px){
    .hdr-link{padding:.4rem .55rem;gap:.4rem}
    .hl-label{font-size:.72rem}
    .hl-sub{font-size:.58rem}
    .hl-icon{font-size:.85rem}
  }

  .empty-state{text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem}
  .footer{text-align:center;padding-top:3rem;font-size:.64rem;color:rgba(92,122,104,.4);letter-spacing:.07em;text-transform:uppercase}

  @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

  /* Global mobile fixes */
  @media(max-width:500px){
    .wrap{padding:0 .6rem 3rem}
    .hdr{padding:1.2rem 0 1rem}
    .badges{gap:.3rem}
    .bdg{font-size:.6rem;padding:.2rem .45rem}
  }
`

// ─── Identity gate ("Je suis : ___") ───────────────────────────────────────
function IdentityGate({ members, onChoose }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem' }}>
      <div style={{ width: '100%', maxWidth: '380px', textAlign: 'center' }}>
        <h1 className="title" style={{ marginBottom: '.3rem' }}><em>Kirghizistan</em> 2026</h1>
        <div style={{ fontSize: '.82rem', color: 'var(--muted)', marginBottom: '1.5rem' }}>Je suis :</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          {members.map(m => (
            <button key={m.name} onClick={() => onChoose(m.name)}
              style={{ padding: '.65rem .9rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--bone)', fontSize: '.88rem', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif", textAlign: 'left' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--amber)'; e.currentTarget.style.color = 'var(--amber)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--bone)' }}
            >{m.name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Inline contact editor ─────────────────────────────────────────────────
function EditContact({ phone, email, onSave, onCancel }) {
  const [ph, setPh] = useState(phone)
  const [em, setEm] = useState(email)
  return (
    <div style={{ gridColumn: '1', display: 'flex', flexDirection: 'column', gap: '.35rem', marginTop: '.4rem' }} onClick={e => e.stopPropagation()}>
      <input autoFocus value={ph} onChange={e => setPh(e.target.value)} placeholder="+33 6 …"
        style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--amber)', borderRadius: '3px', padding: '.38rem .6rem', color: 'var(--bone)', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', outline: 'none', width: '100%' }} />
      <input value={em} onChange={e => setEm(e.target.value)} placeholder="email@…"
        style={{ background: 'rgba(255,255,255,.07)', border: '1px solid var(--border)', borderRadius: '3px', padding: '.38rem .6rem', color: 'var(--bone)', fontFamily: "'DM Sans',sans-serif", fontSize: '.8rem', outline: 'none', width: '100%' }}
        onKeyDown={e => { if (e.key === 'Enter') onSave(ph, em); if (e.key === 'Escape') onCancel() }} />
      <div style={{ display: 'flex', gap: '.35rem' }}>
        <button onClick={() => onSave(ph, em)} style={{ flex: 1, padding: '.3rem', background: 'var(--amber)', color: 'var(--bg)', border: 'none', borderRadius: '3px', fontSize: '.75rem', fontWeight: '500', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>✓ Sauver</button>
        <button onClick={onCancel} style={{ padding: '.3rem .6rem', background: 'transparent', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '3px', fontSize: '.75rem', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>✕</button>
      </div>
    </div>
  )
}

// ─── Main App ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('itinerary')
  const [selectedDay, setSelectedDay] = useState(1)
  const [itinerary, setItinerary] = useState({})
  const [dirtyDay, setDirtyDay] = useState(null)
  const [savedFlash, setSavedFlash] = useState(false)
  const [contacts, setContacts] = useState(() =>
    Object.fromEntries(TRIP.members.map(m => [m.name, { phone: '', email: '' }]))
  )
  const [editingContact, setEditingContact] = useState(null)
  const [sharedNotes, setSharedNotes] = useState([])
  const [noteText, setNoteText] = useState('')
  const [aiOpen, setAiOpen] = useState(false)
  const [aiInput, setAiInput] = useState('')
  const [aiAnswer, setAiAnswer] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [mapPoints, setMapPoints] = useState(DEFAULT_MAP_POINTS)
  const [editingPoint, setEditingPoint] = useState(null)
  const [addingPoint, setAddingPoint] = useState(null) // { day, name }
  const [checklist, setChecklist] = useState(DEFAULT_CHECKLIST)
  const [checklistCats, setChecklistCats] = useState(DEFAULT_CHECKLIST_CATS)
  const [viewedChecklistUser, setViewedChecklistUser] = useState(null)
  const [newItemText, setNewItemText] = useState('')
  const [newItemCat, setNewItemCat] = useState('Équipement')
  const [newCatName, setNewCatName] = useState('')
  const [newCatIcon, setNewCatIcon] = useState('')
  const [backups, setBackups] = useState([])
  const [newBackupName, setNewBackupName] = useState('')
  const flashTimer = useRef(null)
  const dayEditorRef = useRef(null)
  const [countdown, setCountdown] = useState(null)
  const [currentUser, setCurrentUserState] = useState(getCurrentUser)

  function chooseUser(name) {
    setCurrentUser(name)
    setCurrentUserState(name)
  }
  function changeUser() {
    clearCurrentUser()
    setCurrentUserState(null)
  }

  // ── Live countdown to departure ──
  useEffect(() => {
    const departure = new Date(2026, 6, 29, 17, 20, 0) // 29 juil 2026 17h20 vol PC956
    function update() {
      const now = new Date()
      const diff = departure - now
      if (diff <= 0) { setCountdown(null); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setCountdown({ d, h, m, s, total: diff })
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Load all data from Supabase on mount ──
  useEffect(() => {
    async function load() {
      const [itin, ctcts, notes, pts, cl, cats, bks] = await Promise.all([
        kvGet('kg-itin'),
        kvGet('kg-contacts'),
        kvGet('kg-notes'),
        kvGet('kg-mappoints'),
        kvGet('kg-checklist'),
        kvGet('kg-checklist-cats'),
        kvGet('kg-checklist-backups'),
      ])
      if (itin) setItinerary(itin)
      if (ctcts) setContacts(ctcts)
      if (notes) setSharedNotes(notes)
      if (pts) setMapPoints(sortPoints(pts))
      if (cl) setChecklist(cl)
      if (cats) setChecklistCats(cats)
      if (bks) setBackups(bks)
      setLoaded(true)
    }
    load()

    // Real-time subscriptions
    const s1 = kvSubscribe('kg-itin', (val) => setItinerary(val))
    const s2 = kvSubscribe('kg-contacts', (val) => setContacts(val))
    const s3 = kvSubscribe('kg-notes', (val) => setSharedNotes(val))
    const s4 = kvSubscribe('kg-mappoints', (val) => { if (val) setMapPoints(sortPoints(val)) })
    const s5 = kvSubscribe('kg-checklist', (val) => { if (val) setChecklist(val) })
    const s6 = kvSubscribe('kg-checklist-cats', (val) => { if (val) setChecklistCats(val) })

    return () => {
      s1.unsubscribe()
      s2.unsubscribe()
      s3.unsubscribe()
      s4.unsubscribe()
      s5.unsubscribe()
      s6.unsubscribe()
    }
  }, [])

  // ── Current day data ──
  const day = DAYS[selectedDay - 1]
  const saved = itinerary[selectedDay] || emptyDay(day)
  const current = dirtyDay?.num === selectedDay ? dirtyDay.data : saved

  function setField(key, val) {
    setDirtyDay({ num: selectedDay, data: { ...current, [key]: val } })
  }

  // ── Save day to Supabase ──
  async function saveDay() {
    if (!dirtyDay) return
    const updated = { ...itinerary, [selectedDay]: dirtyDay.data }
    setItinerary(updated)
    setDirtyDay(null)
    clearTimeout(flashTimer.current)
    setSavedFlash(true)
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2200)
    await kvSet('kg-itin', updated)
  }

  function goDay(num) {
    setSelectedDay(num)
    setDirtyDay(null)
    setAiOpen(false)
    setAiAnswer('')
    setAiInput('')
    if (window.innerWidth <= 620) {
      setTimeout(() => dayEditorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
    }
  }

  // ── Save contact ──
  async function saveContact(name, phone, email) {
    const updated = { ...contacts, [name]: { phone, email } }
    setContacts(updated)
    setEditingContact(null)
    await kvSet('kg-contacts', updated)
  }

  // ── Add note ──
  async function addNote() {
    if (!noteText.trim()) return
    const n = {
      id: Date.now(),
      author: currentUser,
      text: noteText.trim(),
      ts: new Date().toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }),
    }
    const updated = [...sharedNotes, n]
    setSharedNotes(updated)
    setNoteText('')
    await kvSet('kg-notes', updated)
  }

  // ── AI ──
  async function askAI(question) {
    if (!question.trim() || aiLoading) return
    setAiLoading(true)
    setAiAnswer('')
    try {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          system: SYSTEM,
          messages: [{ role: 'user', content: question }],
        }),
      })
      const data = await res.json()
      setAiAnswer(data.content?.filter(b => b.type === 'text').map(b => b.text).join('') || 'Erreur API.')
    } catch { setAiAnswer('Erreur de connexion.') }
    setAiLoading(false)
  }

  const filled = DAYS.filter(d => itinerary[d.num]?.location).length

  const quickPrompts = day?.phase === 'city' ? [
    `Que faire à Bichkek le jour d'arrivée (30 juillet) après un vol de nuit pour 8 personnes ?`,
    `Quel hôtel recommandes-tu à Bichkek pour 8 personnes ?`,
    `Comment rejoindre le centre depuis l'aéroport Manas pour 8 personnes ?`,
  ] : day?.phase === 'return' ? [
    `Dernier matin avant le vol du 14 août (départ 08h20). Programme pour 8 personnes ?`,
    `Comment rejoindre l'aéroport Manas depuis le centre de Bichkek ?`,
    `Quoi acheter comme souvenirs à Bichkek avant de partir ?`,
  ] : day?.phase === 'horse' ? [
    `Programme de randonnée équestre pour le Jour ${selectedDay} (${day?.dateStr})`,
    `Où dormir en yourte autour du Song-Köl pour le Jour ${selectedDay} ?`,
    `Logistique chevaux + bagages pour 8 personnes au Jour ${selectedDay}`,
  ] : [
    `Programme 4×4 pour le Jour ${selectedDay} (${day?.dateStr}) dans l'est du Kirghizistan`,
    `Hébergement recommandé (gîte, CBT) pour le Jour ${selectedDay}`,
    `Distances et routes depuis ${current.location || 'Bichkek'} pour le Jour ${selectedDay}`,
  ]

  const qBtnLabels = day?.phase === 'city' ? ['Que faire', 'Hôtel', 'Aéroport→Centre']
    : day?.phase === 'return' ? ['Dernier matin', 'Aéroport', 'Souvenirs']
    : day?.phase === 'horse' ? ['Programme', 'Yourte', 'Logistique']
    : ['Programme', 'Hébergement', 'Route']

  const phaseClass = (p) => p === 'city' || p === 'return' ? 'cap' : p === 'horse' ? 'horse' : 'x4'

  // ── Render ──
  if (!currentUser) {
    return (
      <>
        <style>{CSS}</style>
        <IdentityGate members={TRIP.members} onChoose={chooseUser} />
      </>
    )
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">

        {/* Header */}
        <div className="hdr">
          <div className="hdr-row">
            <h1 className="title"><em>Kirghizistan</em> 2026</h1>
            <span className="bdg bdg-a">PNR {TRIP.pnr}</span>
            <button onClick={changeUser} style={{ fontSize: '.7rem', padding: '.3rem .55rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--muted)', cursor: 'pointer', fontFamily: "'DM Sans',sans-serif" }}>👤 {currentUser} · changer</button>
          </div>
          <div className="badges">
            <span className="bdg bdg-o">👥 {TRIP.group} personnes</span>
            <span className="bdg bdg-o">30 juil → 14 août</span>
            <span className="bdg bdg-o">15 nuits</span>
            <span className="bdg bdg-h">🐎 Tatosh J2–J5</span>
            <span className="bdg bdg-l">🚙 4×4 J6–J15</span>
            {loaded && <span className="bdg bdg-g">✓ {filled}/16 jours planifiés</span>}
          </div>
          <div className="hdr-bottom">
            {countdown ? (
              <div className="countdown">
                <div className="cd-label">✈ Décollage vol PC956 dans</div>
                <div className="cd-boxes">
                  <div className="cd-box"><span className="cd-num">{countdown.d}</span><span className="cd-unit">jours</span></div>
                  <span className="cd-sep">:</span>
                  <div className="cd-box"><span className="cd-num">{String(countdown.h).padStart(2, '0')}</span><span className="cd-unit">heures</span></div>
                  <span className="cd-sep">:</span>
                  <div className="cd-box"><span className="cd-num">{String(countdown.m).padStart(2, '0')}</span><span className="cd-unit">min</span></div>
                  <span className="cd-sep">:</span>
                  <div className="cd-box"><span className="cd-num">{String(countdown.s).padStart(2, '0')}</span><span className="cd-unit">sec</span></div>
                </div>
              </div>
            ) : countdown === null && new Date() >= new Date(2026, 6, 29, 17, 20, 0) ? (
              <div style={{ fontSize: '.82rem', color: 'var(--green)', fontFamily: "'Playfair Display',serif" }}>🎉 C'est parti — bon voyage !</div>
            ) : null}
            <div className="hdr-links">
              <a href={TRIP.tricount} target="_blank" rel="noreferrer" className="hdr-link"><span className="hl-icon">💰</span><div><div className="hl-label">Tricount</div><div className="hl-sub">Dépenses</div></div></a>
              <a href={TRIP.drive} target="_blank" rel="noreferrer" className="hdr-link"><span className="hl-icon">📁</span><div><div className="hl-label">Drive</div><div className="hl-sub">Documents</div></div></a>
              <a href={TRIP.miro} target="_blank" rel="noreferrer" className="hdr-link"><span className="hl-icon">🗺</span><div><div className="hl-label">Miro</div><div className="hl-sub">Tableau</div></div></a>
              <a href={TRIP.discord} target="_blank" rel="noreferrer" className="hdr-link"><span className="hl-icon">💬</span><div><div className="hl-label">Discord</div><div className="hl-sub">Groupe</div></div></a>
              <a href={TRIP.whatsapp} target="_blank" rel="noreferrer" className="hdr-link"><span className="hl-icon">📱</span><div><div className="hl-label">WhatsApp</div><div className="hl-sub">Communauté</div></div></a>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {[['itinerary', '📅 Itinéraire'], ['overview', '✈ Vols'], ['agencies', '🐎 Agences'], ['map', '🗺 Carte'], ['contacts', '👥 Groupe'], ['matos', '✅ Checklist'], ['notes', '💬 Notes']].map(([id, l]) => (
            <button key={id} className={`tab ${tab === id ? 'on' : ''}`} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>

        {/* ══ ITINERARY ══ */}
        {tab === 'itinerary' && (
          <div className="layout">
            {/* Sidebar */}
            <div className="day-list">
              <div className="slbl" style={{ color: 'var(--cityl)' }}>🏙 Capitale</div>
              {DAYS.filter(d => d.phase === 'city').map(d => (
                <div key={d.num} className={`day-item cap ${selectedDay === d.num ? 'on' : ''}`} onClick={() => goDay(d.num)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="di-num">J{d.num}</span>
                    {itinerary[d.num]?.confirmed && <span style={{ color: 'var(--green)', fontSize: '.7rem' }}>✓</span>}
                  </div>
                  <div className="di-date">{d.dateStr}</div>
                  <div className="di-loc" style={{ color: 'var(--cityl)', fontSize: '.62rem' }}>Arrivée 07h</div>
                </div>
              ))}
              <div className="phase-sep">🐎 Cheval</div>
              {DAYS.filter(d => d.phase === 'horse').map(d => (
                <div key={d.num} className={`day-item horse ${selectedDay === d.num ? 'on' : ''}`} onClick={() => goDay(d.num)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="di-num">J{d.num}</span>
                    {itinerary[d.num]?.confirmed && <span style={{ color: 'var(--green)', fontSize: '.7rem' }}>✓</span>}
                  </div>
                  <div className="di-date">{d.dateStr}</div>
                  {itinerary[d.num]?.location && <div className="di-loc">{itinerary[d.num].location}</div>}
                </div>
              ))}
              <div className="phase-sep">🚙 4×4</div>
              {DAYS.filter(d => d.phase === '4x4').map(d => (
                <div key={d.num} className={`day-item x4 ${selectedDay === d.num ? 'on' : ''}`} onClick={() => goDay(d.num)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="di-num">J{d.num}</span>
                    {itinerary[d.num]?.confirmed && <span style={{ color: 'var(--green)', fontSize: '.7rem' }}>✓</span>}
                  </div>
                  <div className="di-date">{d.dateStr}</div>
                  {itinerary[d.num]?.location && <div className="di-loc">{itinerary[d.num].location}</div>}
                </div>
              ))}
              <div className="phase-sep">✈ Retour</div>
              {DAYS.filter(d => d.phase === 'return').map(d => (
                <div key={d.num} className={`day-item cap ${selectedDay === d.num ? 'on' : ''}`} onClick={() => goDay(d.num)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="di-num">J{d.num}</span>
                    {itinerary[d.num]?.confirmed && <span style={{ color: 'var(--green)', fontSize: '.7rem' }}>✓</span>}
                  </div>
                  <div className="di-date">{d.dateStr}</div>
                  <div className="di-loc" style={{ color: '#e07050', fontSize: '.62rem' }}>Vol 08h20</div>
                </div>
              ))}
            </div>

            {/* Day editor */}
            <div ref={dayEditorRef}>
              <div className="day-editor">
                <div className="de-header">
                  <div>
                    <div className="de-title">
                      <span style={{ color: day.phase === 'city' || day.phase === 'return' ? 'var(--cityl)' : day.phase === 'horse' ? 'var(--horsel)' : 'var(--lakel)' }}>
                        {day.phase === 'city' ? '🏙' : day.phase === 'return' ? '✈' : day.phase === 'horse' ? '🐎' : '🚙'}
                      </span>{' '}
                      Jour {selectedDay} — {day.dateStr}
                    </div>
                    <div className="de-sub">
                      {day.phase === 'city' ? "Arrivée à Bichkek à 07h00 · Nuit au Halo Hostel"
                        : day.phase === 'return' ? 'Retour · Vol PC703 08h20 → Istanbul → Genève 16h20'
                        : day.phase === 'horse' ? 'Phase équestre · Nuit en yourte'
                        : 'Phase 4×4 · Est du Kirghizistan'}
                    </div>
                  </div>
                  <button className="ai-toggle" onClick={() => { setAiOpen(o => !o); setAiAnswer('') }}>
                    {aiOpen ? '✕ Fermer l\'IA' : '✨ Demander à l\'IA'}
                  </button>
                </div>

                <div className="de-body">
                  <div className="field-row">
                    <div className="field">
                      <label>📍 Lieu / Région</label>
                      <input placeholder="ex : Lac Song-Köl, Karakol…" value={current.location || ''} onChange={e => setField('location', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>🏕 Hébergement</label>
                      <input placeholder={day.phase === 'horse' ? 'Yourte, camp…' : 'Gîte, CBT, hôtel…'} value={current.accommodation || ''} onChange={e => setField('accommodation', e.target.value)} />
                    </div>
                  </div>

                  {day.phase === 'horse' && (
                    <div className="field">
                      <label>🐎 Circuit / Étape équestre</label>
                      <input placeholder="ex : Montée vers Song-Köl via col Moldo-Ashuu (~30 km)" value={current.circuit || ''} onChange={e => setField('circuit', e.target.value)} />
                    </div>
                  )}

                  {day.phase === '4x4' && (
                    <div className="field-row">
                      <div className="field">
                        <label>🚙 Transport</label>
                        <input placeholder="4×4, taxi partagé…" value={current.transport || '4×4'} onChange={e => setField('transport', e.target.value)} />
                      </div>
                      <div className="field">
                        <label>🗺 Distances / Route</label>
                        <input placeholder="ex : Bichkek → Karakol ~350 km" value={current.route || ''} onChange={e => setField('route', e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label>🎯 Activités prévues</label>
                    <textarea
                      placeholder={
                        day.phase === 'city' ? 'ex : Visite Osh Bazaar, musée, repas local, repos…'
                        : day.phase === 'return' ? 'ex : Dernier petit-déj, Osh Bazaar, taxi aéroport…'
                        : day.phase === 'horse' ? 'ex : Randonnée à cheval, baignade lac, rencontre éleveurs nomades…'
                        : 'ex : Canyon Djety-Oguz, source chaude, marché Karakol…'
                      }
                      value={current.activity || ''} onChange={e => setField('activity', e.target.value)}
                    />
                  </div>

                  <div className="field">
                    <label>📝 Notes & infos pratiques</label>
                    <textarea placeholder="Budget, contacts, réservations, points d'attention…" value={current.notes || ''} onChange={e => setField('notes', e.target.value)} />
                  </div>
                </div>

                <div className="de-footer">
                  <label className={`confirm-row ${current.confirmed ? 'checked' : ''}`}>
                    <input type="checkbox" checked={!!current.confirmed} onChange={e => setField('confirmed', e.target.checked)} />
                    {current.confirmed ? '✓ Jour confirmé' : 'Marquer comme confirmé'}
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '.7rem' }}>
                    {savedFlash && <span key={Date.now()} className="saved-flash">✓ Sauvegardé</span>}
                    <button className="save-btn" onClick={saveDay} disabled={!dirtyDay}>💾 Sauvegarder</button>
                  </div>
                </div>

                {/* AI panel */}
                {aiOpen && (
                  <div className="ai-panel">
                    <div className="ai-panel-label">✨ Suggestions IA pour ce jour</div>
                    <div className="ai-q-row">
                      {quickPrompts.map((q, i) => (
                        <button key={i} className="ai-qbtn" onClick={() => { setAiInput(q); askAI(q) }}>{qBtnLabels[i]}</button>
                      ))}
                    </div>
                    <div className="ai-input-row">
                      <input className="ai-input" placeholder="Question libre sur ce jour…" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && askAI(aiInput)} />
                      <button className="ai-send" onClick={() => askAI(aiInput)} disabled={aiLoading || !aiInput.trim()}>Envoyer</button>
                    </div>
                    {aiLoading && <div className="ai-answer"><div className="typing"><span /><span /><span /></div></div>}
                    {aiAnswer && <div className="ai-answer">{aiAnswer}</div>}
                  </div>
                )}
              </div>

              {/* Progress bar */}
              <div style={{ marginTop: '1rem' }}>
                <div className="slbl">{filled} / 16 jours renseignés</div>
                <div className="progress-row">
                  {DAYS.map(d => (
                    <div key={d.num} className={`prog-cell ${itinerary[d.num]?.location ? `done-${d.phase === 'horse' ? 'horse' : d.phase === '4x4' ? '4x4' : 'city'}` : ''}`} title={`J${d.num} ${d.dateStr}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ OVERVIEW ══ */}
        {tab === 'overview' && (
          <>
            <div className="slbl">✈ Aller — {TRIP.departure.date}</div>
            {[['PC956', 'Genève (GVA)', 'Istanbul (SAW)', '17h20 → 21h25'], ['PC702', 'Istanbul (SAW)', 'Bichkek (BSZ)', '23h05 → 07h00 (+1)']].map(([n, f, t, h]) => (
              <div key={n} className="flight-card"><span className="f-num">{n}</span><span className="f-txt">{f} → {t} · {h}</span><span className="f-dir f-out">Aller</span></div>
            ))}
            <div style={{ marginTop: '1.1rem' }} />
            <div className="slbl">✈ Retour — {TRIP.returnFlight.date}</div>
            {[['PC703', 'Bichkek (BSZ)', 'Istanbul (SAW)', '08h20 → 11h15'], ['PC955', 'Istanbul (SAW)', 'Genève (GVA)', '14h05 → 16h20']].map(([n, f, t, h]) => (
              <div key={n} className="flight-card"><span className="f-num">{n}</span><span className="f-txt">{f} → {t} · {h}</span><span className="f-dir f-in">Retour</span></div>
            ))}
            <div className="stats">
              {[['8', 'voyageurs'], ['15', 'nuits'], ['4', 'jours cheval'], ['20kg', 'bagages soute'], ['8kg', 'bagage cabine · 55×40×23cm']].map(([n, l]) => (
                <div key={l} className="stat"><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
              ))}
            </div>
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="slbl">👥 Le groupe</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(min(180px, 100%),1fr))', gap: '.4rem' }}>
                {TRIP.members.map((m, i) => (
                  <div key={m.name} style={{ background: m.name === currentUser ? 'rgba(76,175,122,.15)' : 'var(--bg2)', border: `1px solid ${m.name === currentUser ? 'rgba(76,175,122,.35)' : 'var(--border)'}`, borderRadius: '3px', padding: '.55rem .8rem', fontSize: '.82rem', display: 'flex', alignItems: 'center', gap: '.5rem' }}>
                    <span style={{ color: 'var(--amber)', fontFamily: "'Playfair Display',serif", fontSize: '.9rem' }}>{i + 1}</span>
                    <span>{m.name}</span>
                    {m.name === currentUser && <span style={{ marginLeft: 'auto', fontSize: '.65rem', color: 'var(--green)' }}>moi</span>}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ══ AGENCIES ══ */}
        {tab === 'agencies' && (
          <>
            <div className="slbl">🐎 Agences pour la randonnée équestre</div>
            {AGENCIES.map(a => (
              <div key={a.id} className="ag-card" style={{ borderLeft: `3px solid ${a.chosen ? 'var(--green)' : 'var(--border)'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '.5rem', flexWrap: 'wrap' }}>
                  <div className="ag-name" style={{ color: a.chosen ? 'var(--green)' : 'var(--muted)' }}>{a.name}</div>
                  {a.chosen && <span style={{ fontSize: '.68rem', background: 'rgba(76,175,122,.15)', color: 'var(--green)', border: '1px solid rgba(76,175,122,.3)', borderRadius: '2px', padding: '.15rem .5rem', textTransform: 'uppercase', letterSpacing: '.07em' }}>Choisi ✓</span>}
                </div>
                <div className="ag-note" style={{ color: a.chosen ? 'var(--bone)' : 'var(--muted)' }}>{a.note}</div>
                {a.contact && <div style={{ fontSize: '.74rem', color: 'var(--muted)', marginTop: '.3rem' }}>Contact : {a.contact}</div>}
                {a.url && <a className="ag-url" href={a.url} target="_blank" rel="noreferrer">↗ Voir leur offre Song-Köl</a>}
                {!a.chosen && <div style={{ fontSize: '.74rem', color: 'var(--muted)', marginTop: '.5rem', fontStyle: 'italic' }}>Non retenu par le vote du groupe</div>}
              </div>
            ))}
            <div style={{ marginTop: '.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)', borderRadius: '3px', padding: '1rem' }}>
              <div className="slbl">✅ Décision du groupe</div>
              <div style={{ fontSize: '.88rem', color: 'var(--green)', fontWeight: '500', marginBottom: '.4rem' }}>Tatosh sélectionné · 8 votes vs 6</div>
              <div style={{ fontSize: '.8rem', color: 'var(--muted)' }}>Contact initial : Henri Blln · À confirmer dès que possible</div>
            </div>
            <div style={{ marginTop: '.75rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1rem' }}>
              <div className="slbl">📋 À confirmer avec Tatosh</div>
              {['✓ Disponibilité à partir du 31 juillet (4 jours)', '○ Confirmation du tarif 200€/p pour 8 personnes', '○ Niveau équitation requis', '○ Yourtes incluses chaque nuit', '○ Logistique bagages pendant la phase cheval', '○ Programme exact jour par jour', '○ Assurance incluse ?'].map((q, i) => (
                <div key={i} style={{ fontSize: '.81rem', padding: '.3rem 0', borderBottom: '1px solid var(--border)', color: q.startsWith('✓') ? 'var(--green)' : 'var(--bone)', display: 'flex', gap: '.5rem' }}>{q}</div>
              ))}
            </div>
          </>
        )}

        {/* ══ MAP ══ */}
        {tab === 'map' && (() => {
          const savePoints = (pts) => {
            const sorted = sortPoints(pts)
            setMapPoints(sorted)
            kvSet('kg-mappoints', sorted)
            const updatedItin = syncMapToItinerary(sorted, itinerary)
            setItinerary(updatedItin)
            kvSet('kg-itin', updatedItin)
          }
          const handleDragEnd = (id) => (e) => {
            const { lat, lng } = e.target.getLatLng()
            savePoints(mapPoints.map(p => p.id === id ? { ...p, lat: Math.round(lat * 10000) / 10000, lng: Math.round(lng * 10000) / 10000 } : p))
          }
          const confirmAddPoint = () => {
            if (!addingPoint?.name) return
            const last = mapPoints[mapPoints.length - 1]
            const nextId = Math.max(...mapPoints.map(p => p.id)) + 1
            const dayDef = DAYS[addingPoint.day - 1]
            const sameDayPts = mapPoints.filter(p => p.day === addingPoint.day)
            const ref = sameDayPts.length > 0 ? sameDayPts[sameDayPts.length - 1] : last
            savePoints([...mapPoints, { id: nextId, name: addingPoint.name, lat: ref.lat + 0.12, lng: ref.lng + 0.15, phase: dayDef?.phase || '4x4', day: addingPoint.day, desc: '' }])
            setAddingPoint(null)
          }
          const updatePoint = (id, field, value) => {
            if (field === 'day') {
              const dayNum = Number(value)
              const dayDef = DAYS[dayNum - 1]
              savePoints(mapPoints.map(p => p.id === id ? { ...p, day: dayNum, phase: dayDef?.phase || p.phase } : p))
            } else {
              savePoints(mapPoints.map(p => p.id === id ? { ...p, [field]: value } : p))
            }
          }
          const deletePoint = (id) => {
            if (mapPoints.length <= 1) return
            const p = mapPoints.find(pt => pt.id === id)
            if (!confirm(`Supprimer le point "${p?.name || ''}" ?`)) return
            savePoints(mapPoints.filter(pt => pt.id !== id))
          }
          const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', padding: '.4rem .6rem', color: 'var(--bone)', fontSize: '.8rem' }
          return (
          <>
            <div className="slbl">🗺 Carte de l'itinéraire</div>
            <p style={{ fontSize: '.74rem', color: 'var(--muted)', marginBottom: '.8rem' }}>Déplacez les marqueurs · Cliquez pour éditer · Les lieux se synchronisent avec l'itinéraire</p>
            <div style={{ height: 'min(500px, 60vh)', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '1rem' }}>
              <MapContainer center={[42.0, 75.3]} zoom={8} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {mapPoints.map((p) => {
                  const label = getPointLabel(p, mapPoints)
                  const isLong = label.length > 2
                  const size = isLong ? 26 : 18
                  return (
                  <Marker key={p.id} position={[p.lat, p.lng]} draggable={true}
                    eventHandlers={{ dragend: handleDragEnd(p.id) }}
                    icon={L.divIcon({ className: '', html: `<div style="min-width:${size}px;height:${size}px;border-radius:${isLong ? '10px' : '50%'};padding:0 ${isLong ? '4px' : '0'};background:${PHASE_COLORS[p.phase]};border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.4);display:flex;align-items:center;justify-content:center;color:#fff;font-size:${isLong ? '8px' : '9px'};font-weight:700;white-space:nowrap">${label}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] })}>
                    <Popup>
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontSize: '.7rem', color: '#999', marginBottom: '2px' }}>{label}</div>
                        <div style={{ fontFamily: "'Playfair Display',serif", fontWeight: 600, marginBottom: '4px', fontSize: '.95rem' }}>{p.name}</div>
                        {p.desc && <div style={{ fontSize: '.78rem', color: '#666', marginBottom: '6px' }}>{p.desc}</div>}
                        <div style={{ fontSize: '.7rem', color: '#999', marginBottom: '8px' }}>{p.lat}, {p.lng}</div>
                        <button onClick={() => setEditingPoint(p.id)} style={{ fontSize: '.72rem', padding: '3px 8px', background: '#f0f0f0', border: '1px solid #ccc', borderRadius: '3px', cursor: 'pointer', marginRight: '4px' }}>Modifier</button>
                        <button onClick={() => deletePoint(p.id)} style={{ fontSize: '.72rem', padding: '3px 8px', background: '#fee', border: '1px solid #ecc', borderRadius: '3px', cursor: 'pointer', color: '#c33' }}>Supprimer</button>
                      </div>
                    </Popup>
                  </Marker>
                  )
                })}
                <Polyline positions={mapPoints.map(p => [p.lat, p.lng])} color="#c4956a" weight={2.5} opacity={0.7} dashArray="8 5" />
              </MapContainer>
            </div>

            {/* Edit point form */}
            {editingPoint && (() => {
              const p = mapPoints.find(pt => pt.id === editingPoint)
              if (!p) return null
              return (
                <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--amber)', borderRadius: '3px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem' }}>
                    <div style={{ fontSize: '.82rem', fontFamily: "'Playfair Display',serif", color: 'var(--bone)' }}>Modifier — {getPointLabel(p, mapPoints)}</div>
                    <button onClick={() => setEditingPoint(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.9rem' }}>✕</button>
                  </div>
                  <div style={{ display: 'grid', gap: '.5rem' }}>
                    <input value={p.name} onChange={e => updatePoint(p.id, 'name', e.target.value)} placeholder="Nom du lieu" style={inputStyle} />
                    <input value={p.desc} onChange={e => updatePoint(p.id, 'desc', e.target.value)} placeholder="Description (optionnel)" style={inputStyle} />
                    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                      <select value={p.day} onChange={e => updatePoint(p.id, 'day', e.target.value)} style={{ ...inputStyle, flex: '1 1 150px', minWidth: 0 }}>
                        {DAYS.map(d => <option key={d.num} value={d.num}>J{d.num} — {d.dateStr}</option>)}
                      </select>
                      <div style={{ fontSize: '.72rem', color: 'var(--muted)', alignSelf: 'center', whiteSpace: 'nowrap' }}>{p.lat}, {p.lng}</div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* Add point form */}
            {addingPoint ? (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderLeft: '3px solid #5b9bd5', borderRadius: '3px', padding: '1rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '.6rem' }}>
                  <div style={{ fontSize: '.82rem', fontFamily: "'Playfair Display',serif", color: 'var(--bone)' }}>Nouvelle étape</div>
                  <button onClick={() => setAddingPoint(null)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.9rem' }}>✕</button>
                </div>
                <div style={{ display: 'grid', gap: '.5rem' }}>
                  <select value={addingPoint.day} onChange={e => setAddingPoint(a => ({ ...a, day: Number(e.target.value) }))} style={inputStyle}>
                    {DAYS.map(d => <option key={d.num} value={d.num}>J{d.num} — {d.dateStr} ({d.phase === 'city' ? 'Ville' : d.phase === 'horse' ? 'Cheval' : d.phase === '4x4' ? '4×4' : 'Retour'})</option>)}
                  </select>
                  <input value={addingPoint.name} onChange={e => setAddingPoint(a => ({ ...a, name: e.target.value }))} placeholder="Nom du lieu (ex: Karakol, Issyk-Köl…)" style={inputStyle} autoFocus />
                  <button onClick={confirmAddPoint} disabled={!addingPoint.name} style={{ fontSize: '.78rem', padding: '.4rem .8rem', background: addingPoint.name ? 'rgba(91,155,213,.15)' : 'var(--bg)', border: '1px solid rgba(91,155,213,.3)', borderRadius: '3px', color: addingPoint.name ? '#5b9bd5' : 'var(--muted)', cursor: addingPoint.name ? 'pointer' : 'default' }}>Ajouter sur la carte</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem', marginBottom: '.5rem' }}>
                <button onClick={() => setAddingPoint({ day: Math.max(...mapPoints.map(p => p.day)) + 1 > 16 ? 16 : Math.max(...mapPoints.map(p => p.day)) + 1, name: '' })} style={{ fontSize: '.78rem', padding: '.4rem .8rem', background: 'rgba(91,155,213,.15)', border: '1px solid rgba(91,155,213,.3)', borderRadius: '3px', color: '#5b9bd5', cursor: 'pointer' }}>+ Ajouter une étape</button>
                <div style={{ display: 'flex', gap: '.6rem', fontSize: '.72rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
                  {[['city', 'Capitale'], ['horse', 'Cheval'], ['4x4', '4×4']].map(([phase, label]) => (
                    <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: '.3rem' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: PHASE_COLORS[phase], display: 'inline-block' }}></span>
                      {label}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Point list grouped by day */}
            <div style={{ marginTop: '.5rem' }}>
              {(() => {
                let lastDay = null
                return mapPoints.map((p) => {
                  const label = getPointLabel(p, mapPoints)
                  const showDaySep = p.day !== lastDay
                  lastDay = p.day
                  const dayDef = DAYS[p.day - 1]
                  return (
                    <div key={p.id}>
                      {showDaySep && <div style={{ fontSize: '.68rem', color: 'var(--muted)', padding: '.35rem .6rem .1rem', marginTop: '.3rem', borderTop: '1px solid var(--border)', fontFamily: "'Playfair Display',serif", letterSpacing: '.03em' }}>Jour {p.day} — {dayDef?.dateStr || ''}</div>}
                      <div onClick={() => setEditingPoint(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '.6rem', padding: '.4rem .6rem', background: editingPoint === p.id ? 'rgba(196,149,106,.1)' : 'transparent', borderRadius: '3px', cursor: 'pointer' }}>
                        <span style={{ minWidth: '28px', height: '20px', borderRadius: '10px', padding: '0 4px', background: PHASE_COLORS[p.phase], display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '.6rem', fontWeight: 700, flexShrink: 0 }}>{label}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '.8rem', color: 'var(--bone)', fontWeight: 500 }}>{p.name}</div>
                          {p.desc && <div style={{ fontSize: '.7rem', color: 'var(--muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.desc}</div>}
                        </div>
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </>
          )
        })()}

        {/* ══ CONTACTS ══ */}
        {tab === 'contacts' && (
          <>
            <div className="slbl">👥 Les 8 membres — cliquer pour éditer</div>
            <p style={{ fontSize: '.74rem', color: 'var(--muted)', marginBottom: '.8rem' }}>Format international (+33…) · Sauvegardé en temps réel</p>
            <div className="contacts-grid">
              {TRIP.members.map((m, i) => {
                const c = contacts[m.name] || { phone: '', email: '' }
                const isEditing = editingContact === m.name
                return (
                  <div key={m.name} className="contact-card" style={m.name === currentUser ? { background: 'rgba(76,175,122,.15)', borderColor: 'rgba(76,175,122,.35)' } : undefined} onClick={() => !isEditing && setEditingContact(m.name)}>
                    <div className="contact-name">{m.name}{m.name === currentUser && <span style={{ marginLeft: '.5rem', fontSize: '.65rem', color: 'var(--green)' }}>moi</span>}</div>
                    {isEditing ? (
                      <EditContact phone={c.phone} email={c.email} onSave={(ph, em) => saveContact(m.name, ph, em)} onCancel={() => setEditingContact(null)} />
                    ) : (
                      <div className="contact-info">
                        {c.phone ? <span>📱 {c.phone}</span> : <span className="contact-empty">📱 cliquer pour ajouter</span>}
                        {c.email ? <a href={`mailto:${c.email}`} onClick={e => e.stopPropagation()}>✉ {c.email}</a> : <span className="contact-empty">✉ cliquer pour ajouter</span>}
                      </div>
                    )}
                    <span className="contact-idx">{i + 1}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '1.2rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '3px', padding: '1rem' }}>
              <div className="slbl">📋 Contacts utiles sur place</div>
              {[
                { label: 'Tatosh (agence cheval)', val: '— à compléter via Henri', icon: '🐎' },
                { label: 'Urgences Kirghizistan', val: '112 · 103 (ambulance)', icon: '🚨' },
                { label: 'Ambassade de France – Bichkek', val: '+996 312 97 31 00', icon: '🇫🇷' },
                { label: 'Aéroport Manas', val: '+996 312 69 30 00', icon: '✈' },
              ].map((c, i) => (
                <div key={i} style={{ display: 'flex', gap: '.6rem', padding: '.4rem 0', borderBottom: '1px solid var(--border)', fontSize: '.82rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span>{c.icon}</span>
                  <span style={{ color: 'var(--muted)', minWidth: '140px', flex: '0 0 auto' }}>{c.label}</span>
                  <span style={{ color: 'var(--bone)', wordBreak: 'break-word' }}>{c.val}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ CHECKLIST ══ */}
        {tab === 'matos' && (() => {
          const viewing = viewedChecklistUser || currentUser
          const isReadOnly = viewing !== currentUser
          const saveCheck = (data) => { setChecklist(data); kvSet('kg-checklist', data) }
          const toggleItem = (itemId) => {
            if (isReadOnly) return
            const arr = checklist.checked[currentUser] || []
            const next = arr.includes(itemId) ? arr.filter(id => id !== itemId) : [...arr, itemId]
            saveCheck({ ...checklist, checked: { ...checklist.checked, [currentUser]: next } })
          }
          const addItem = () => {
            if (!newItemText.trim()) return
            const nextId = Math.max(0, ...checklist.items.map(i => i.id)) + 1
            saveCheck({ ...checklist, items: [...checklist.items, { id: nextId, text: newItemText.trim(), cat: newItemCat }] })
            setNewItemText('')
          }
          const removeItem = (itemId) => {
            const item = checklist.items.find(i => i.id === itemId)
            if (!confirm(`Supprimer "${item?.text || ''}" pour tout le monde ?`)) return
            const newChecked = {}
            for (const [name, arr] of Object.entries(checklist.checked)) {
              newChecked[name] = arr.filter(id => id !== itemId)
            }
            saveCheck({ items: checklist.items.filter(i => i.id !== itemId), checked: newChecked })
          }
          const moveItem = (itemId, dir) => {
            const item = checklist.items.find(i => i.id === itemId)
            const catIds = checklist.items.filter(i => i.cat === item.cat).map(i => i.id)
            const idx = catIds.indexOf(itemId)
            const swapId = catIds[idx + dir]
            if (swapId === undefined) return
            const items = [...checklist.items]
            const i1 = items.findIndex(i => i.id === itemId)
            const i2 = items.findIndex(i => i.id === swapId)
            ;[items[i1], items[i2]] = [items[i2], items[i1]]
            saveCheck({ ...checklist, items })
          }
          const changeItemCat = (itemId, cat) => {
            saveCheck({ ...checklist, items: checklist.items.map(i => i.id === itemId ? { ...i, cat } : i) })
          }
          const MAX_BACKUPS = 10
          const backupChecklist = () => {
            const name = newBackupName.trim() || `Sauvegarde du ${new Date().toLocaleDateString('fr-FR')}`
            const entry = { id: Date.now(), name, date: new Date().toISOString(), items: checklist.items }
            const next = [entry, ...backups].slice(0, MAX_BACKUPS)
            setBackups(next)
            kvSet('kg-checklist-backups', next)
            setNewBackupName('')
          }
          const restoreBackup = (entry) => {
            if (!confirm(`Restaurer "${entry.name}" (${entry.items.length} items) ? Les items actuels seront remplacés.`)) return
            saveCheck({ items: entry.items, checked: Object.fromEntries(TRIP.members.map(m => [m.name, []])) })
          }
          const deleteBackup = (id) => {
            const entry = backups.find(b => b.id === id)
            if (!confirm(`Supprimer la sauvegarde "${entry?.name || ''}" ?`)) return
            const next = backups.filter(b => b.id !== id)
            setBackups(next)
            kvSet('kg-checklist-backups', next)
          }
          const addCategory = () => {
            const name = newCatName.trim()
            if (!name) return
            if (checklistCats.some(c => c.id.toLowerCase() === name.toLowerCase())) { alert('Cette catégorie existe déjà.'); return }
            const nextCats = [...checklistCats, { id: name, icon: newCatIcon.trim() || '📦' }]
            setChecklistCats(nextCats)
            kvSet('kg-checklist-cats', nextCats)
            setNewCatName('')
            setNewCatIcon('')
          }
          const resetChecklist = () => {
            if (!confirm('Réinitialiser la checklist entière (items, catégories et cases cochées) pour tout le monde ?')) return
            setChecklist(DEFAULT_CHECKLIST)
            setChecklistCats(DEFAULT_CHECKLIST_CATS)
            kvSet('kg-checklist', DEFAULT_CHECKLIST)
            kvSet('kg-checklist-cats', DEFAULT_CHECKLIST_CATS)
          }
          const userChecked = checklist.checked[viewing] || []
          const totalItems = checklist.items.length
          const checkedCount = userChecked.length
          const pct = totalItems > 0 ? Math.round((checkedCount / totalItems) * 100) : 0
          const inputStyle = { background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', padding: '.4rem .6rem', color: 'var(--bone)', fontSize: '.8rem' }

          return (
          <>
            {/* Header */}
            <div className="slbl">✅ Checklist — Matos & Logistique</div>
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '3px', padding: '.8rem 1rem', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', flexWrap: 'wrap', marginBottom: '.6rem' }}>
                <label style={{ fontSize: '.76rem', color: 'var(--muted)' }}>Checklist de</label>
                <select value={viewing} onChange={e => setViewedChecklistUser(e.target.value === currentUser ? null : e.target.value)} style={{ ...inputStyle, flex: '0 1 200px' }}>
                  {TRIP.members.map(m => <option key={m.name} value={m.name}>{m.name}{m.name === currentUser ? ' (moi)' : ''}</option>)}
                </select>
                {isReadOnly && <span style={{ fontSize: '.68rem', color: 'var(--muted)', border: '1px solid var(--border)', borderRadius: '3px', padding: '.15rem .4rem' }}>🔒 Lecture seule</span>}
                <div style={{ fontSize: '.78rem', color: 'var(--bone)', fontFamily: "'Playfair Display',serif", marginLeft: 'auto' }}>{checkedCount}/{totalItems}</div>
              </div>
              <div style={{ height: '6px', background: 'var(--bg)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'var(--green)' : 'var(--amber)', borderRadius: '3px', transition: 'width .3s' }} />
              </div>
            </div>

            {/* Categories */}
            {checklistCats.map(cat => {
              const catItems = checklist.items.filter(i => i.cat === cat.id)
              if (catItems.length === 0) return null
              const catChecked = catItems.filter(i => userChecked.includes(i.id)).length
              return (
                <div key={cat.id} style={{ marginBottom: '1rem' }}>
                  <div style={{ fontSize: '.8rem', color: 'var(--bone)', fontFamily: "'Playfair Display',serif", marginBottom: '.4rem', display: 'flex', alignItems: 'center', gap: '.4rem' }}>
                    <span>{cat.icon}</span> {cat.id}
                    <span style={{ fontSize: '.68rem', color: 'var(--muted)', fontFamily: 'system-ui' }}>({catChecked}/{catItems.length})</span>
                  </div>
                  {catItems.map((item, itemIdx) => {
                    const isChecked = userChecked.includes(item.id)
                    const othersWhoChecked = TRIP.members.filter(m => m.name !== viewing && (checklist.checked[m.name] || []).includes(item.id))
                    return (
                      <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', padding: '.35rem .4rem', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
                          <button onClick={() => moveItem(item.id, -1)} disabled={itemIdx === 0} title="Monter" style={{ background: 'none', border: 'none', color: itemIdx === 0 ? 'var(--border)' : 'var(--muted)', cursor: itemIdx === 0 ? 'default' : 'pointer', fontSize: '.6rem', lineHeight: 1, padding: '1px' }}>▲</button>
                          <button onClick={() => moveItem(item.id, 1)} disabled={itemIdx === catItems.length - 1} title="Descendre" style={{ background: 'none', border: 'none', color: itemIdx === catItems.length - 1 ? 'var(--border)' : 'var(--muted)', cursor: itemIdx === catItems.length - 1 ? 'default' : 'pointer', fontSize: '.6rem', lineHeight: 1, padding: '1px' }}>▼</button>
                        </div>
                        <input type="checkbox" checked={isChecked} disabled={isReadOnly} onChange={() => toggleItem(item.id)} style={{ accentColor: 'var(--amber)', cursor: isReadOnly ? 'default' : 'pointer', flexShrink: 0 }} />
                        <div style={{ flex: 1, fontSize: '.8rem', color: isChecked ? 'var(--muted)' : 'var(--bone)', textDecoration: isChecked ? 'line-through' : 'none' }}>{item.text}</div>
                        <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                          {othersWhoChecked.map(m => (
                            <span key={m.name} title={m.name} style={{ width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(196,149,106,.2)', color: 'var(--amber)', fontSize: '.55rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {m.name.split(' ').map(w => w[0]).join('')}
                            </span>
                          ))}
                        </div>
                        <select value={item.cat} onChange={e => changeItemCat(item.id, e.target.value)} title="Déplacer vers une autre catégorie" style={{ flexShrink: 0, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--muted)', fontSize: '.68rem', padding: '.15rem 1.3rem .15rem .35rem', width: '128px' }}>
                          {checklistCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
                        </select>
                        <button onClick={() => removeItem(item.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.7rem', padding: '2px 4px', opacity: .5 }} title="Supprimer pour tout le monde">✕</button>
                      </div>
                    )
                  })}
                </div>
              )
            })}

            {/* Add item */}
            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginTop: '.5rem', marginBottom: '.7rem', flexWrap: 'wrap' }}>
              <input value={newItemText} onChange={e => setNewItemText(e.target.value)} onKeyDown={e => e.key === 'Enter' && addItem()} placeholder="Ajouter un item…" style={{ ...inputStyle, flex: '1 1 150px', minWidth: 0 }} />
              <select value={newItemCat} onChange={e => setNewItemCat(e.target.value)} style={{ ...inputStyle, flex: '0 0 auto', width: '130px' }}>
                {checklistCats.map(c => <option key={c.id} value={c.id}>{c.icon} {c.id}</option>)}
              </select>
              <button onClick={addItem} disabled={!newItemText.trim()} style={{ padding: '.4rem .7rem', background: newItemText.trim() ? 'rgba(196,149,106,.15)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', color: newItemText.trim() ? 'var(--amber)' : 'var(--muted)', cursor: newItemText.trim() ? 'pointer' : 'default', fontSize: '.82rem' }}>+</button>
            </div>

            {/* Add category */}
            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap' }}>
              <input value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} placeholder="🏷" style={{ ...inputStyle, flex: '0 0 auto', width: '48px', textAlign: 'center' }} maxLength={4} />
              <input value={newCatName} onChange={e => setNewCatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCategory()} placeholder="Nouvelle catégorie…" style={{ ...inputStyle, flex: '1 1 150px', minWidth: 0 }} />
              <button onClick={addCategory} disabled={!newCatName.trim()} style={{ padding: '.4rem .7rem', background: newCatName.trim() ? 'rgba(196,149,106,.15)' : 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', color: newCatName.trim() ? 'var(--amber)' : 'var(--muted)', cursor: newCatName.trim() ? 'pointer' : 'default', fontSize: '.82rem' }}>+ Catégorie</button>
            </div>

            {/* Backup / Restore + Reset + Discord */}
            <div style={{ display: 'flex', gap: '.4rem', alignItems: 'center', flexWrap: 'wrap', marginBottom: backups.length ? '.6rem' : 0 }}>
              <input value={newBackupName} onChange={e => setNewBackupName(e.target.value)} onKeyDown={e => e.key === 'Enter' && backupChecklist()} placeholder="Nom de la sauvegarde…" style={{ ...inputStyle, flex: '1 1 160px', minWidth: 0 }} />
              <button onClick={backupChecklist} style={{ fontSize: '.72rem', padding: '.35rem .6rem', background: 'rgba(76,175,122,.1)', border: '1px solid rgba(76,175,122,.25)', borderRadius: '3px', color: 'var(--green)', cursor: 'pointer' }}>💾 Sauvegarder</button>
              <button onClick={resetChecklist} style={{ fontSize: '.72rem', padding: '.35rem .6rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '3px', color: 'var(--muted)', cursor: 'pointer' }}>⟲ Réinitialiser</button>
              <a href={TRIP.discord} target="_blank" rel="noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: '.4rem', padding: '.35rem .6rem', background: 'rgba(114,137,218,.1)', border: '1px solid rgba(114,137,218,.2)', borderRadius: '3px', color: '#7289da', fontSize: '.72rem', textDecoration: 'none', marginLeft: 'auto' }}>
                💬 Discord
              </a>
            </div>
            {backups.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
                {backups.map(b => (
                  <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '.5rem', fontSize: '.74rem', padding: '.35rem .55rem', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '3px', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--bone)' }}>💾 {b.name}</span>
                    <span style={{ color: 'var(--muted)' }}>{new Date(b.date).toLocaleDateString('fr-FR')} · {b.items.length} items</span>
                    <div style={{ marginLeft: 'auto', display: 'flex', gap: '.4rem' }}>
                      <button onClick={() => restoreBackup(b)} style={{ fontSize: '.7rem', padding: '.2rem .5rem', background: 'rgba(224,112,80,.1)', border: '1px solid rgba(224,112,80,.25)', borderRadius: '3px', color: '#e07050', cursor: 'pointer' }}>♻ Restaurer</button>
                      <button onClick={() => deleteBackup(b.id)} style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '.72rem', opacity: .6 }} title="Supprimer cette sauvegarde">✕</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
          )
        })()}

        {/* ══ NOTES ══ */}
        {tab === 'notes' && (
          <div className="notes-panel">
            <div className="np-header">
              <div className="np-title">Notes du groupe</div>
              <div className="live"><div className="ldot" /><span>Temps réel · Supabase</span></div>
            </div>
            <div className="np-list">
              {sharedNotes.length === 0
                ? <div className="empty-state">Aucune note. Sois le premier à écrire !</div>
                : [...sharedNotes].reverse().map(n => (
                  <div key={n.id} className="note">
                    <div className="note-meta"><span>{n.author}</span><span>{n.ts}</span></div>
                    <div className="note-txt">{n.text}</div>
                  </div>
                ))}
            </div>
            <div className="np-input">
              <div className="ni-name" style={{ display: 'flex', alignItems: 'center' }}>👤 {currentUser}</div>
              <textarea className="ni-text" rows={1} placeholder="Une idée, info, question…" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addNote() } }} />
              <button className="ni-btn" onClick={addNote} disabled={!noteText.trim()}>Ajouter</button>
            </div>
          </div>
        )}

        <div className="footer">Kirghizistan 2026 · 8 voyageurs · PNR 1NLCW9 · Propulsé par Claude</div>
      </div>
    </>
  )
}

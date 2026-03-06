import { useState, useEffect, useRef } from "react";

// ─── Trip constants ────────────────────────────────────────────────────────
const TRIP = {
  pnr: "1NLCW9",
  group: 8,
  departure: { date: "29 juil 2026", flights: ["PC956 GVA→SAW 17h20", "PC702 SAW→BSZ 23h05"] },
  returnFlight: { date: "14 août 2026", flights: ["PC703 BSZ→SAW 08h20", "PC955 SAW→GVA 14h05"] },
  members: [
    { name: "Clara Ka" },
    { name: "Henri Blln" },
    { name: "Mael Demmerle" },
    { name: "Maëlle Guegaden" },
    { name: "Nathan Rougier" },
    { name: "Remy Launois" },
    { name: "Thibault Azemar" },
    { name: "Thomas Mestrou" },
  ],
  tricount: "https://tricount.com/toQoxjLLDpiWDYrUGb",
  drive: "https://drive.google.com/drive/folders/1EYBsgJAOiabYTCtLQQ1D0zBIisESeV36?usp=sharing",
  horseAgency: "Tatosh",
  horseContact: "Henri Blln",
};

const AGENCIES = [
  { id: "tatosh", name: "Tatosh", url: null, note: "4j/3n · 200€/p · ✅ CHOISI PAR LE GROUPE", chosen: true, contact: "Henri Blln (premier contact)" },
  { id: "visitalay", name: "Visit Alay", url: "https://visitalay.com/tour/song-kol-horse-trek-adventure/", note: "5j/4n · 730€/p · Non retenu", chosen: false },
];

// Build 16 days Jul 30 → Aug 14
function buildDays() {
  const mo = ["jan","fév","mar","avr","mai","jun","jul","aoû","sep","oct","nov","déc"];
  const dn = ["Dim","Lun","Mar","Mer","Jeu","Ven","Sam"];
  return Array.from({ length: 16 }, (_, i) => {
    const d = new Date(2026, 6, 30); d.setDate(d.getDate() + i);
    return {
      num: i + 1,
      dateStr: `${dn[d.getDay()]} ${d.getDate()} ${mo[d.getMonth()]}`,
      phase: i === 0 ? "city" : i === 15 ? "return" : i < 6 ? "horse" : "4x4",
      isArrival: i === 0,
      isDeparture: i === 15,
    };
  });
}
const DAYS = buildDays();

// Default empty day data
function emptyDay(day) {
  if (day.phase === "city") return {
    location: "Bichkek", activity: "", accommodation: "Hôtel", notes: "", confirmed: false,
  };
  if (day.phase === "return") return {
    location: "Bichkek", activity: "Vol PC703 08h20 → Istanbul → Genève 16h20", accommodation: "Aéroport Manas", notes: "", confirmed: false,
  };
  if (day.phase === "horse") return {
    location: "", activity: "", accommodation: "Yourte", circuit: "", notes: "", confirmed: false,
  };
  return { location: "", activity: "", accommodation: "", transport: "4×4", notes: "", confirmed: false };
}

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

  /* Header */
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

  /* Tabs */
  .tabs{display:flex;border-bottom:1px solid var(--border);margin-bottom:1.8rem;gap:0}
  .tab{padding:.6rem 1.1rem;font-size:.79rem;font-weight:500;text-transform:uppercase;letter-spacing:.08em;cursor:pointer;border-bottom:2px solid transparent;color:var(--muted);transition:all .15s;background:none;border-top:none;border-left:none;border-right:none;font-family:'DM Sans',sans-serif}
  .tab:hover{color:var(--bone)}
  .tab.on{color:var(--amber);border-bottom-color:var(--amber)}

  /* Section label */
  .slbl{font-size:.68rem;text-transform:uppercase;letter-spacing:.13em;color:var(--amber);margin-bottom:.7rem}

  /* Two-col layout */
  .layout{display:grid;grid-template-columns:220px 1fr;gap:1rem;align-items:start}
  @media(max-width:620px){.layout{grid-template-columns:1fr}}

  /* Day sidebar */
  .day-list{display:flex;flex-direction:column;gap:.3rem;position:sticky;top:1rem}
  .day-item{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.55rem .7rem;cursor:pointer;transition:all .15s;border-left:3px solid transparent}
  .day-item:hover{border-color:var(--amber);background:var(--bg3)}
  .day-item.on{border-color:var(--amber);background:var(--amberd)}
  .day-item.horse{border-left-color:var(--horse)}
  .day-item.x4{border-left-color:var(--lake)}
  .day-item.on.horse{border-color:var(--horse);background:var(--horsed)}
  .day-item.on.x4{border-color:var(--lake);background:var(--laked)}
  .day-item.cap{border-left-color:var(--city)}
  .day-item.on.cap{border-color:var(--city);background:var(--cityd)}
  .di-num{font-family:'Playfair Display',serif;font-size:1rem;color:var(--amber);line-height:1}
  .di-date{font-size:.65rem;color:var(--muted);margin-top:.1rem}
  .di-loc{font-size:.7rem;color:var(--bone);margin-top:.15rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:140px}
  .di-dot{width:6px;height:6px;border-radius:50%;background:var(--green);display:inline-block;margin-left:.3rem;vertical-align:middle}
  .phase-sep{font-size:.65rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);padding:.5rem .2rem .3rem;display:flex;align-items:center;gap:.4rem}
  .phase-sep::after{content:'';flex:1;height:1px;background:var(--border)}

  /* Day editor */
  .day-editor{background:var(--bg2);border:1px solid var(--border);border-radius:4px;overflow:hidden}
  .de-header{padding:1rem 1.2rem;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.6rem}
  .de-title{font-family:'Playfair Display',serif;font-size:1.1rem;color:var(--bone)}
  .de-sub{font-size:.73rem;color:var(--muted);margin-top:.1rem}
  .de-body{padding:1.1rem 1.2rem;display:flex;flex-direction:column;gap:.85rem}
  .field-row{display:grid;grid-template-columns:1fr 1fr;gap:.7rem}
  @media(max-width:500px){.field-row{grid-template-columns:1fr}}
  .field{display:flex;flex-direction:column;gap:.3rem}
  .field label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
  .field input,.field textarea,.field select{background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.55rem .75rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.84rem;outline:none;transition:border-color .15s;width:100%}
  .field input:focus,.field textarea:focus,.field select:focus{border-color:var(--amber)}
  .field input::placeholder,.field textarea::placeholder{color:var(--muted)}
  .field textarea{resize:vertical;min-height:72px}
  .field select option{background:var(--bg3);color:var(--bone)}
  .de-footer{padding:.8rem 1.2rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap}
  .confirm-row{display:flex;align-items:center;gap:.5rem;cursor:pointer;font-size:.8rem;color:var(--muted)}
  .confirm-row input{accent-color:var(--green)}
  .confirm-row.checked{color:var(--green)}
  .save-btn{padding:.5rem 1rem;background:var(--amber);color:var(--bg);border:none;border-radius:3px;font-size:.82rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
  .save-btn:hover{background:var(--amberl)}
  .save-btn:disabled{opacity:.5;cursor:not-allowed}
  .saved-flash{font-size:.72rem;color:var(--green);animation:fadeOut 2s forwards}
  @keyframes fadeOut{0%,60%{opacity:1}100%{opacity:0}}

  /* AI panel inside editor */
  .ai-toggle{padding:.5rem .85rem;border:1px solid var(--amberd);border-radius:3px;background:transparent;color:var(--amberl);font-size:.76rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;display:flex;align-items:center;gap:.4rem}
  .ai-toggle:hover{background:var(--amberd)}
  .ai-panel{background:var(--bg3);border-top:1px solid var(--border);padding:1rem 1.2rem}
  .ai-panel-label{font-size:.68rem;text-transform:uppercase;letter-spacing:.1em;color:var(--amber);margin-bottom:.6rem}
  .ai-q-row{display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:.7rem}
  .ai-qbtn{padding:.28rem .65rem;border:1px solid rgba(212,146,28,.22);border-radius:2px;background:transparent;color:var(--amberl);font-size:.7rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
  .ai-qbtn:hover{background:var(--amberd)}
  .ai-input-row{display:flex;gap:.4rem}
  .ai-input{flex:1;background:rgba(255,255,255,.05);border:1px solid var(--border);border-radius:3px;padding:.5rem .75rem;color:var(--bone);font-family:'DM Sans',sans-serif;font-size:.82rem;outline:none}
  .ai-input:focus{border-color:var(--amber)}
  .ai-input::placeholder{color:var(--muted)}
  .ai-send{padding:.5rem .85rem;background:var(--amber);color:var(--bg);border:none;border-radius:3px;font-size:.8rem;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
  .ai-send:hover:not(:disabled){background:var(--amberl)}
  .ai-send:disabled{opacity:.5;cursor:not-allowed}
  .ai-answer{margin-top:.75rem;background:rgba(255,255,255,.04);border:1px solid rgba(212,146,28,.16);border-radius:3px;padding:.8rem 1rem;font-size:.82rem;line-height:1.65;color:var(--bone);white-space:pre-wrap}
  .typing{display:flex;gap:4px;padding:.3rem 0}
  .typing span{width:6px;height:6px;border-radius:50%;background:var(--amber);animation:bounce 1.2s ease-in-out infinite}
  .typing span:nth-child(2){animation-delay:.2s}
  .typing span:nth-child(3){animation-delay:.4s}

  /* Overview tab */
  .flight-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.8rem 1rem;margin-bottom:.4rem;display:flex;align-items:center;gap:.8rem;flex-wrap:wrap}
  .f-num{font-family:'Playfair Display',serif;color:var(--amber);font-size:.9rem;min-width:50px}
  .f-txt{font-size:.82rem;color:var(--bone)}
  .f-dir{font-size:.66rem;padding:.16rem .5rem;border-radius:2px;text-transform:uppercase;letter-spacing:.07em;font-weight:500}
  .f-out{background:var(--amberd);color:var(--amberl)}
  .f-in{background:rgba(192,57,27,.1);color:#e07050}
  .stats{display:grid;grid-template-columns:repeat(4,1fr);gap:1px;background:var(--border);border-radius:3px;overflow:hidden;margin:1.4rem 0}
  .stat{background:var(--bg2);padding:.9rem;text-align:center}
  .stat-n{font-family:'Playfair Display',serif;font-size:1.7rem;color:var(--amber);font-weight:700;line-height:1}
  .stat-l{font-size:.65rem;text-transform:uppercase;letter-spacing:.09em;color:var(--muted);margin-top:.28rem}

  /* Progress bar */
  .progress-row{display:flex;gap:.5rem;margin:1rem 0;flex-wrap:wrap}
  .prog-cell{flex:1;min-width:24px;height:8px;border-radius:2px;background:var(--bg3)}
  .prog-cell.done{background:var(--green)}
  .prog-cell.horse{background:var(--horse)}
  .prog-cell.x4{background:var(--lake)}

  /* Agency tab */
  .ag-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:1rem;margin-bottom:.6rem}
  .ag-name{font-family:'Playfair Display',serif;font-size:1rem;margin-bottom:.2rem}
  .ag-note{font-size:.78rem;color:var(--muted)}
  .ag-url{font-size:.72rem;color:var(--amber);text-decoration:none;display:inline-block;margin-top:.4rem}
  .ag-url:hover{text-decoration:underline}
  .vote-row{display:flex;gap:.4rem;align-items:center;margin-top:.7rem}
  .vote-btn{padding:.28rem .7rem;border:1px solid var(--border);border-radius:2px;background:transparent;color:var(--muted);font-size:.72rem;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s}
  .vote-btn:hover:not(:disabled){border-color:var(--amber);color:var(--amberl)}
  .vote-btn.voted{background:var(--amberd);color:var(--amberl);border-color:var(--amber)}
  .vote-ct{font-size:.72rem;color:var(--muted)}

  /* Shared notes */
  .notes-panel{background:var(--bg2);border:1px solid var(--border);border-radius:3px;overflow:hidden}
  .np-header{padding:.8rem 1rem;background:rgba(212,146,28,.07);border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center}
  .np-title{font-family:'Playfair Display',serif;font-size:.95rem}
  .live{display:flex;align-items:center;gap:.3rem;font-size:.67rem;color:var(--green)}
  .ldot{width:5px;height:5px;border-radius:50%;background:var(--green);animation:pulse 2s infinite}
  .np-list{padding:.8rem 1rem;min-height:80px;max-height:300px;overflow-y:auto;display:flex;flex-direction:column;gap:.5rem}
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

  .empty-state{text-align:center;padding:1.5rem;color:var(--muted);font-size:.8rem}
  /* Contacts */
  .contact-card{background:var(--bg2);border:1px solid var(--border);border-radius:3px;padding:.9rem 1rem;display:grid;grid-template-columns:1fr auto;gap:.3rem .8rem;align-items:start}
  .contact-name{font-family:'Playfair Display',serif;font-size:.98rem;color:var(--bone);grid-column:1}
  .contact-role{font-size:.68rem;color:var(--amberl);grid-column:1;margin-top:-.1rem}
  .contact-info{font-size:.79rem;color:var(--muted);grid-column:1;display:flex;flex-direction:column;gap:.18rem;margin-top:.35rem}
  .contact-info a{color:var(--lakel);text-decoration:none}
  .contact-info a:hover{text-decoration:underline}
  .contact-empty{font-size:.72rem;color:rgba(92,122,104,.5);font-style:italic}
  .contact-idx{font-family:'Playfair Display',serif;font-size:1.4rem;color:var(--amber);opacity:.35;grid-column:2;grid-row:1/3;align-self:center}
  .contacts-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:.5rem;margin-top:.8rem}

  .footer{text-align:center;padding-top:3rem;font-size:.64rem;color:rgba(92,122,104,.4);letter-spacing:.07em;text-transform:uppercase}
  @keyframes bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}
`;

// Claude system prompt
const SYSTEM = `Tu es un expert en voyages au Kirghizistan. Aide un groupe de 8 amis à planifier leur voyage.

VOYAGE :
- Groupe : 8 personnes, vols Pegasus PNR 1NLCW9
- Arrivée Bichkek : 30 juillet 2026 à 07h00
- Départ : 14 août 2026 à 08h20
- 15 nuits sur place
- J1 (30 juil) : arrivée à BICHKEK, découverte de la capitale, hôtel
- Phase équestre (J2–J6, 31 juil–4 août) : randonnée ÉQUESTRE, nuits en YOURTE, agence CHOISIE : TATOSH (4j/3n, 200€/p, contact: Henri Blln)
- J16 (14 août) : RETOUR, vol PC703 Bichkek 08h20 → Istanbul → Genève 16h20
- Phase 2 (J6–J16, 4–14 août) : 4×4, EST du Kirghizistan, Issyk-Koul, Karakol, Djety-Oguz etc.

Réponds en français, de façon concrète et précise. Utilise des listes. Pense à la logistique pour 8 personnes.`;

// ─── Inline contact editor ────────────────────────────────────────────────
function EditContact({ phone, email, onSave, onCancel }) {
  const [ph, setPh] = useState(phone);
  const [em, setEm] = useState(email);
  return (
    <div style={{gridColumn:"1",display:"flex",flexDirection:"column",gap:".35rem",marginTop:".4rem"}} onClick={e=>e.stopPropagation()}>
      <input
        autoFocus
        value={ph} onChange={e=>setPh(e.target.value)}
        placeholder="+33 6 …"
        style={{background:"rgba(255,255,255,.07)",border:"1px solid var(--amber)",borderRadius:"3px",padding:".38rem .6rem",color:"var(--bone)",fontFamily:"'DM Sans',sans-serif",fontSize:".8rem",outline:"none",width:"100%"}}
      />
      <input
        value={em} onChange={e=>setEm(e.target.value)}
        placeholder="email@…"
        style={{background:"rgba(255,255,255,.07)",border:"1px solid var(--border)",borderRadius:"3px",padding:".38rem .6rem",color:"var(--bone)",fontFamily:"'DM Sans',sans-serif",fontSize:".8rem",outline:"none",width:"100%"}}
        onKeyDown={e=>{if(e.key==="Enter") onSave(ph,em); if(e.key==="Escape") onCancel();}}
      />
      <div style={{display:"flex",gap:".35rem"}}>
        <button onClick={()=>onSave(ph,em)} style={{flex:1,padding:".3rem",background:"var(--amber)",color:"var(--bg)",border:"none",borderRadius:"3px",fontSize:".75rem",fontWeight:"500",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✓ Sauver</button>
        <button onClick={onCancel} style={{padding:".3rem .6rem",background:"transparent",color:"var(--muted)",border:"1px solid var(--border)",borderRadius:"3px",fontSize:".75rem",cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>✕</button>
      </div>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("itinerary");
  const [selectedDay, setSelectedDay] = useState(1);
  const [itinerary, setItinerary] = useState({}); // { dayNum: {...} }
  const [dirtyDay, setDirtyDay] = useState(null);   // unsaved changes
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sharedNotes, setSharedNotes] = useState([]);
  const [votes, setVotes] = useState({});
  const [myVotes, setMyVotes] = useState({});
  const [noteName, setNoteName] = useState("");
  const [noteText, setNoteText] = useState("");
  const [aiOpen, setAiOpen] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [contacts, setContacts] = useState(() => Object.fromEntries(TRIP.members.map(m => [m.name, { phone: "", email: "" }])));
  const [editingContact, setEditingContact] = useState(null); // name of member being edited
  const flashTimer = useRef(null);

  // ── Load all shared data ──
  useEffect(() => {
    async function load() {
      try { const r = await window.storage.get("kg2-itin", true); if (r) setItinerary(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kg2-notes", true); if (r) setSharedNotes(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kg2-votes", true); if (r) setVotes(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kg2-myvotes"); if (r) setMyVotes(JSON.parse(r.value)); } catch {}
      setStorageLoaded(true);
    }
    load();
    const iv = setInterval(async () => {
      try { const r = await window.storage.get("kg2-itin", true); if (r) setItinerary(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kg2-notes", true); if (r) setSharedNotes(JSON.parse(r.value)); } catch {}
      try { const r = await window.storage.get("kg2-votes", true); if (r) setVotes(JSON.parse(r.value)); } catch {}
    }, 12000);
    return () => clearInterval(iv);
  }, []);

  // ── Current day data (live edit) ──
  const day = DAYS[selectedDay - 1];
  const saved = itinerary[selectedDay] || emptyDay(day);
  const current = dirtyDay?.num === selectedDay ? dirtyDay.data : saved;

  function setField(key, val) {
    setDirtyDay({ num: selectedDay, data: { ...current, [key]: val } });
  }

  // ── Save day ──
  async function saveDay() {
    if (!dirtyDay) return;
    const updated = { ...itinerary, [selectedDay]: dirtyDay.data };
    setItinerary(updated);
    setDirtyDay(null);
    clearTimeout(flashTimer.current);
    setSavedFlash(true);
    flashTimer.current = setTimeout(() => setSavedFlash(false), 2200);
    try { await window.storage.set("kg2-itin", JSON.stringify(updated), true); } catch {}
  }

  // ── Navigate day ──
  function goDay(num) {
    setSelectedDay(num);
    setDirtyDay(null);
    setAiOpen(false);
    setAiAnswer("");
    setAiInput("");
  }

  // ── AI for this day ──
  async function askAI(question) {
    if (!question.trim() || aiLoading) return;
    setAiLoading(true);
    setAiAnswer("");
    try {
      const userQ = question || `Propose un programme détaillé pour le Jour ${selectedDay} (${day.dateStr}), phase ${day.phase === "horse" ? "équestre" : "4×4"}. Lieu actuel noté : "${current.location || "non défini"}".`;
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1000,
          system: SYSTEM,
          messages: [{ role: "user", content: userQ }],
        }),
      });
      const data = await res.json();
      setAiAnswer(data.content?.filter(b => b.type === "text").map(b => b.text).join("") || "Erreur API.");
    } catch { setAiAnswer("Erreur de connexion."); }
    setAiLoading(false);
  }

  // ── Save contact info ──
  async function saveContact(name, phone, email) {
    const updated = { ...contacts, [name]: { phone, email } };
    setContacts(updated);
    setEditingContact(null);
    try { await window.storage.set("kg2-contacts", JSON.stringify(updated), true); } catch {}
  }

  // ── Notes ──
  async function addNote() {
    if (!noteText.trim()) return;
    const n = { id: Date.now(), author: noteName.trim() || "Anonyme", text: noteText.trim(), ts: new Date().toLocaleString("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) };
    const updated = [...sharedNotes, n];
    setSharedNotes(updated);
    setNoteText("");
    try { await window.storage.set("kg2-notes", JSON.stringify(updated), true); } catch {}
  }

  // ── Votes ──
  async function castVote(id) {
    if (myVotes[id]) return;
    const nv = { ...votes, [id]: (votes[id] || 0) + 1 };
    const nm = { ...myVotes, [id]: true };
    setVotes(nv); setMyVotes(nm);
    try { await window.storage.set("kg2-votes", JSON.stringify(nv), true); await window.storage.set("kg2-myvotes", JSON.stringify(nm)); } catch {}
  }

  // ── Completion stats ──
  const filled = DAYS.filter(d => itinerary[d.num]?.location).length;

  // Quick prompts for the selected day
  const quickPrompts = day?.phase === "city" ? [
    `Que faire à Bichkek le jour d'arrivée (30 juillet) après un vol de nuit pour 8 personnes ?`,
    `Quel hôtel recommandes-tu à Bichkek pour 8 personnes (bon rapport qualité/prix) ?`,
    `Comment rejoindre le centre de Bichkek depuis l'aéroport Manas pour 8 personnes ?`,
  ] : day?.phase === "return" ? [
    `Dernier matin avant le vol du 14 août (départ 08h20). Que faire le matin à Bichkek pour 8 personnes ?`,
    `Comment rejoindre l'aéroport Manas depuis le centre de Bichkek ? Durée, options transport ?`,
    `Quoi acheter comme souvenirs à Bichkek avant de partir ?`,
  ] : day?.phase === "horse" ? [
    `Programme de randonnée équestre pour le Jour ${selectedDay} (${day?.dateStr})`,
    `Où dormir en yourte autour du Song-Köl pour le Jour ${selectedDay} ?`,
    `Logistique chevaux + bagages pour 8 personnes au Jour ${selectedDay}`,
  ] : [
    `Programme 4×4 pour le Jour ${selectedDay} (${day?.dateStr}) dans l'est du Kirghizistan`,
    `Hébergement recommandé (gîte, CBT) pour le Jour ${selectedDay}`,
    `Distances et routes depuis ${current.location || "Bichkek"} pour le Jour ${selectedDay}`,
  ];

  return (
    <>
      <style>{CSS}</style>
      <div className="wrap">

        {/* ── Header ── */}
        <div className="hdr">
          <div className="hdr-row">
            <h1 className="title"><em>Kirghizistan</em> 2026</h1>
            <span className="bdg bdg-a">PNR {TRIP.pnr}</span>
          </div>
          <div className="badges">
            <span className="bdg bdg-o">👥 {TRIP.group} personnes</span>
            <span className="bdg bdg-o">30 juil → 14 août</span>
            <span className="bdg bdg-o">15 nuits</span>
            <span className="bdg bdg-h">🏙 Bichkek J1</span>
            <span className="bdg bdg-h">🐎 Cheval J2–J6</span>
            <span className="bdg bdg-l">🚙 4×4 J6–J16</span>
            {storageLoaded && <span className="bdg bdg-g">✓ {filled}/16 jours planifiés</span>}
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="tabs">
          {[["itinerary","📅 Itinéraire"],["overview","✈ Vols"],["agencies","🐎 Agences"],["contacts","👥 Groupe"],["notes","💬 Notes groupe"]].map(([id,l]) => (
            <button key={id} className={`tab ${tab===id?"on":""}`} onClick={() => setTab(id)}>{l}</button>
          ))}
        </div>

        {/* ══ ITINERARY TAB ══ */}
        {tab === "itinerary" && (
          <div className="layout">
            {/* Sidebar: day list */}
            <div className="day-list">
              <div className="slbl">🏙 Capitale</div>
              {DAYS.filter(d => d.phase === "city").map(d => {
                const data = itinerary[d.num];
                return (
                  <div key={d.num} className={`day-item cap ${selectedDay===d.num?"on":""}`} onClick={() => goDay(d.num)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span className="di-num">J{d.num}</span>
                      {data?.confirmed && <span title="Confirmé" style={{color:"var(--green)",fontSize:".7rem"}}>✓</span>}
                    </div>
                    <div className="di-date">{d.dateStr}</div>
                    <div className="di-loc" style={{color:"var(--cityl)",fontSize:".65rem"}}>Bichkek · Arrivée 07h</div>
                  </div>
                );
              })}
              <div className="phase-sep">🐎 Cheval · Yourtes</div>
              {DAYS.filter(d => d.phase === "horse").map(d => {
                const data = itinerary[d.num];
                return (
                  <div key={d.num} className={`day-item horse ${selectedDay===d.num?"on":""}`} onClick={() => goDay(d.num)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span className="di-num">J{d.num}</span>
                      {data?.confirmed && <span title="Confirmé" style={{color:"var(--green)",fontSize:".7rem"}}>✓</span>}
                    </div>
                    <div className="di-date">{d.dateStr}</div>
                    {data?.location && <div className="di-loc">{data.location}</div>}
                  </div>
                );
              })}
              <div className="phase-sep">🚙 4×4 · Est</div>
              {DAYS.filter(d => d.phase === "4x4").map(d => {
                const data = itinerary[d.num];
                return (
                  <div key={d.num} className={`day-item x4 ${selectedDay===d.num?"on":""}`} onClick={() => goDay(d.num)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span className="di-num">J{d.num}</span>
                      {data?.confirmed && <span title="Confirmé" style={{color:"var(--green)",fontSize:".7rem"}}>✓</span>}
                    </div>
                    <div className="di-date">{d.dateStr}</div>
                    {data?.location && <div className="di-loc">{data.location}</div>}
                  </div>
                );
              })}
              <div className="phase-sep">✈ Retour</div>
              {DAYS.filter(d => d.phase === "return").map(d => {
                const data = itinerary[d.num];
                return (
                  <div key={d.num} className={`day-item cap ${selectedDay===d.num?"on":""}`} onClick={() => goDay(d.num)}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline"}}>
                      <span className="di-num">J{d.num}</span>
                      {data?.confirmed && <span title="Confirmé" style={{color:"var(--green)",fontSize:".7rem"}}>✓</span>}
                    </div>
                    <div className="di-date">{d.dateStr}</div>
                    <div className="di-loc" style={{color:"#e07050",fontSize:".65rem"}}>Vol 08h20 → Genève</div>
                  </div>
                );
              })}
            </div>

            {/* Day editor */}
            <div>
              <div className="day-editor">
                <div className="de-header">
                  <div>
                    <div className="de-title">
                      <span style={{color: day.phase==="city"||day.phase==="return"?"var(--cityl)":day.phase==="horse"?"var(--horsel)":"var(--lakel)"}}>
                        {day.phase === "city" ? "🏙" : day.phase === "return" ? "✈" : day.phase === "horse" ? "🐎" : "🚙"}
                      </span>{" "}
                      Jour {selectedDay} — {day.dateStr}
                    </div>
                    <div className="de-sub">
                      {day.phase === "city" ? "Arrivée à Bichkek à 07h00 · Nuit à l'hôtel" : day.phase === "return" ? "Retour · Vol PC703 08h20 → Istanbul → Genève 16h20" : day.phase === "horse" ? "Phase équestre · Nuit en yourte" : "Phase 4×4 · Est du Kirghizistan"}
                    </div>
                  </div>
                  <button className="ai-toggle" onClick={() => { setAiOpen(o => !o); setAiAnswer(""); }}>
                    {aiOpen ? "✕ Fermer l'IA" : "✨ Demander à l'IA"}
                  </button>
                </div>

                <div className="de-body">
                  <div className="field-row">
                    <div className="field">
                      <label>📍 Lieu / Région</label>
                      <input placeholder="ex : Lac Song-Köl, Karakol…" value={current.location || ""} onChange={e => setField("location", e.target.value)} />
                    </div>
                    <div className="field">
                      <label>🏕 Hébergement</label>
                      <input
                        placeholder={day.phase === "horse" ? "Yourte, camp…" : "Gîte, CBT, hôtel…"}
                        value={current.accommodation || ""}
                        onChange={e => setField("accommodation", e.target.value)}
                      />
                    </div>
                  </div>

                  {day.phase === "horse" && (
                    <div className="field">
                      <label>🐎 Circuit / Étape équestre</label>
                      <input placeholder="ex : Montée vers Song-Köl via col Moldo-Ashuu (~30 km)" value={current.circuit || ""} onChange={e => setField("circuit", e.target.value)} />
                    </div>
                  )}

                  {day.phase === "4x4" && (
                    <div className="field-row">
                      <div className="field">
                        <label>🚙 Transport</label>
                        <input placeholder="4×4, taxi partagé…" value={current.transport || "4×4"} onChange={e => setField("transport", e.target.value)} />
                      </div>
                      <div className="field">
                        <label>🗺 Distances / Route</label>
                        <input placeholder="ex : Bichkek → Karakol ~350 km" value={current.route || ""} onChange={e => setField("route", e.target.value)} />
                      </div>
                    </div>
                  )}

                  <div className="field">
                    <label>🎯 Activités prévues</label>
                    <textarea placeholder={day.phase === "city" ? "ex : Visite Osh Bazaar, musée, repas local, repos…" : day.phase === "return" ? "ex : Dernier petit-déj, Osh Bazaar, taxi aéroport…" : day.phase === "horse" ? "ex : Randonnée à cheval, baignade lac, rencontre éleveurs nomades…" : "ex : Canyon Djety-Oguz, source chaude, marché Karakol…"} value={current.activity || ""} onChange={e => setField("activity", e.target.value)} />
                  </div>

                  <div className="field">
                    <label>📝 Notes & infos pratiques</label>
                    <textarea placeholder="Budget, contacts, réservations, points d'attention…" value={current.notes || ""} onChange={e => setField("notes", e.target.value)} />
                  </div>
                </div>

                <div className="de-footer">
                  <label className={`confirm-row ${current.confirmed ? "checked" : ""}`}>
                    <input type="checkbox" checked={!!current.confirmed} onChange={e => setField("confirmed", e.target.checked)} />
                    {current.confirmed ? "✓ Jour confirmé" : "Marquer comme confirmé"}
                  </label>
                  <div style={{display:"flex",alignItems:"center",gap:"0.7rem"}}>
                    {savedFlash && <span key={Date.now()} className="saved-flash">✓ Sauvegardé</span>}
                    <button className="save-btn" onClick={saveDay} disabled={!dirtyDay}>
                      💾 Sauvegarder
                    </button>
                  </div>
                </div>

                {/* AI panel */}
                {aiOpen && (
                  <div className="ai-panel">
                    <div className="ai-panel-label">✨ Suggestions IA pour ce jour</div>
                    <div className="ai-q-row">
                      {quickPrompts.map((q, i) => (
                        <button key={i} className="ai-qbtn" onClick={() => { setAiInput(q); askAI(q); }}>{day?.phase === "city" ? ["Que faire","Hôtel","Aéroport→Centre"][i] : day?.phase === "return" ? ["Dernier matin","Aéroport","Souvenirs"][i] : day?.phase === "horse" ? ["Programme","Yourte","Logistique"][i] : ["Programme","Hébergement","Route"][i]}</button>
                      ))}
                    </div>
                    <div className="ai-input-row">
                      <input className="ai-input" placeholder="Question libre sur ce jour…" value={aiInput} onChange={e => setAiInput(e.target.value)} onKeyDown={e => e.key === "Enter" && askAI(aiInput)} />
                      <button className="ai-send" onClick={() => askAI(aiInput)} disabled={aiLoading || !aiInput.trim()}>Envoyer</button>
                    </div>
                    {aiLoading && <div className="ai-answer"><div className="typing"><span/><span/><span/></div></div>}
                    {aiAnswer && <div className="ai-answer">{aiAnswer}</div>}
                  </div>
                )}
              </div>

              {/* Progress */}
              <div style={{marginTop:"1rem"}}>
                <div className="slbl">{filled} / 16 jours renseignés</div>
                <div className="progress-row">
                  {DAYS.map(d => (
                    <div key={d.num} className={`prog-cell ${itinerary[d.num]?.location ? (d.phase === "horse" ? "horse" : "x4") : ""}`} title={`J${d.num} ${d.dateStr}`} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ OVERVIEW TAB ══ */}
        {tab === "overview" && (
          <>
            <div className="slbl">✈ Aller — {TRIP.departure.date}</div>
            {[["PC956","Genève (GVA)","Istanbul (SAW)","17h20 → 21h25"],["PC702","Istanbul (SAW)","Bichkek (BSZ)","23h05 → 07h00 (+1)"]].map(([n,f,t,h]) => (
              <div key={n} className="flight-card"><span className="f-num">{n}</span><span className="f-txt">{f} → {t} · {h}</span><span className="f-dir f-out">Aller</span></div>
            ))}
            <div style={{marginTop:"1.1rem"}} />
            <div className="slbl">✈ Retour — {TRIP.returnFlight.date}</div>
            {[["PC703","Bichkek (BSZ)","Istanbul (SAW)","08h20 → 11h15"],["PC955","Istanbul (SAW)","Genève (GVA)","14h05 → 16h20"]].map(([n,f,t,h]) => (
              <div key={n} className="flight-card"><span className="f-num">{n}</span><span className="f-txt">{f} → {t} · {h}</span><span className="f-dir f-in">Retour</span></div>
            ))}
            <div className="stats">
              {[["8","voyageurs"],["15","nuits"],["4–5","jours cheval"],["20kg","bagages soute"]].map(([n,l]) => (
                <div key={l} className="stat"><div className="stat-n">{n}</div><div className="stat-l">{l}</div></div>
              ))}
            </div>
          </>
        )}

        {/* ══ AGENCIES TAB ══ */}
        {tab === "agencies" && (
          <>
            <div className="slbl">🐎 Agences pour la randonnée équestre</div>
            {AGENCIES.map(a => (
              <div key={a.id} className="ag-card" style={{borderLeft:`3px solid ${a.chosen?"var(--green)":"var(--border)"}`}}>
                <div style={{display:"flex",alignItems:"center",gap:".5rem",flexWrap:"wrap"}}>
                  <div className="ag-name" style={{color:a.chosen?"var(--green)":"var(--muted)"}}>{a.name}</div>
                  {a.chosen && <span style={{fontSize:".68rem",background:"rgba(76,175,122,.15)",color:"var(--green)",border:"1px solid rgba(76,175,122,.3)",borderRadius:"2px",padding:".15rem .5rem",textTransform:"uppercase",letterSpacing:".07em"}}>Choisi ✓</span>}
                </div>
                <div className="ag-note" style={{color:a.chosen?"var(--bone)":"var(--muted)"}}>{a.note}</div>
                {a.contact && <div style={{fontSize:".74rem",color:"var(--muted)",marginTop:".3rem"}}>Contact : {a.contact}</div>}
                {a.url && <a className="ag-url" href={a.url} target="_blank" rel="noreferrer">↗ Voir leur offre Song-Köl</a>}
                {!a.chosen && <div style={{fontSize:".74rem",color:"var(--muted)",marginTop:".5rem",fontStyle:"italic"}}>Non retenu par le vote du groupe</div>}
              </div>
            ))}
            <div style={{marginTop:"1.2rem",background:"var(--bg2)",border:"1px solid var(--border)",borderLeft:"3px solid var(--green)",borderRadius:"3px",padding:"1rem"}}>
              <div className="slbl">✅ Décision du groupe</div>
              <div style={{fontSize:".88rem",color:"var(--green)",fontWeight:"500",marginBottom:".4rem"}}>Tatosh sélectionné · 8 votes vs 6</div>
              <div style={{fontSize:".8rem",color:"var(--muted)"}}>Contact initial : Henri Blln · À confirmer dès que possible</div>
            </div>
            <div style={{marginTop:".75rem",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"3px",padding:"1rem"}}>
              <div className="slbl">📋 À confirmer avec Tatosh</div>
              {["✓ Disponibilité à partir du 31 juillet (4 jours)","○ Confirmation du tarif 200€/p pour 8 personnes","○ Niveau équitation requis (certains débutants dans le groupe)","○ Yourtes incluses chaque nuit","○ Logistique bagages : où stocker les affaires 4×4 pendant la phase cheval ?","○ Programme exact jour par jour","○ Assurance / responsabilité incluse ?"].map((q,i) => (
                <div key={i} style={{fontSize:".81rem",padding:".3rem 0",borderBottom:"1px solid var(--border)",color: q.startsWith("✓") ? "var(--green)" : "var(--bone)",display:"flex",gap:".5rem"}}>
                  {q}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ══ NOTES TAB ══ */}
        {tab === "notes" && (
          <div className="notes-panel">
            <div className="np-header">
              <div className="np-title">Notes du groupe</div>
              <div className="live"><div className="ldot"/><span>Partagé · rafraîchi toutes les 12s</span></div>
            </div>
            <div className="np-list">
              {sharedNotes.length === 0
                ? <div className="empty-state">Aucune note. Sois le premier à écrire quelque chose !</div>
                : [...sharedNotes].reverse().map(n => (
                  <div key={n.id} className="note">
                    <div className="note-meta"><span>{n.author}</span><span>{n.ts}</span></div>
                    <div className="note-txt">{n.text}</div>
                  </div>
                ))
              }
            </div>
            <div className="np-input">
              <input className="ni-name" placeholder="Ton prénom" value={noteName} onChange={e => setNoteName(e.target.value)} />
              <textarea className="ni-text" rows={1} placeholder="Une idée, info, question pour le groupe…" value={noteText} onChange={e => setNoteText(e.target.value)} onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); addNote(); }}} />
              <button className="ni-btn" onClick={addNote} disabled={!noteText.trim()}>Ajouter</button>
            </div>
          </div>
        )}

        {/* ══ CONTACTS TAB ══ */}
        {tab === "contacts" && (
          <>
            {/* Tricount + Drive quick links */}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1.2rem"}}>
              <a href={TRIP.tricount} target="_blank" rel="noreferrer" style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"3px",padding:".8rem 1rem",textDecoration:"none",display:"flex",alignItems:"center",gap:".6rem"}}>
                <span style={{fontSize:"1.2rem"}}>💰</span>
                <div><div style={{fontSize:".82rem",color:"var(--bone)",fontWeight:"500"}}>Tricount</div><div style={{fontSize:".7rem",color:"var(--muted)"}}>Partage des dépenses</div></div>
              </a>
              <a href={TRIP.drive} target="_blank" rel="noreferrer" style={{background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"3px",padding:".8rem 1rem",textDecoration:"none",display:"flex",alignItems:"center",gap:".6rem"}}>
                <span style={{fontSize:"1.2rem"}}>📁</span>
                <div><div style={{fontSize:".82rem",color:"var(--bone)",fontWeight:"500"}}>Google Drive</div><div style={{fontSize:".7rem",color:"var(--muted)"}}>Dossier Kirghizistan</div></div>
              </a>
            </div>

            <p className="slbl">👥 Les 8 membres — cliquer pour éditer</p>
            <p style={{fontSize:".74rem",color:"var(--muted)",marginBottom:".8rem"}}>Format international (+33…) · Partagé avec le groupe en temps réel</p>
            <div className="contacts-grid">
              {TRIP.members.map((m, i) => {
                const c = contacts[m.name] || { phone: "", email: "" };
                const isEditing = editingContact === m.name;
                return (
                  <div key={m.name} className="contact-card" style={{cursor:"pointer"}} onClick={() => !isEditing && setEditingContact(m.name)}>
                    <div className="contact-name">{m.name}</div>
                    {isEditing ? (
                      <EditContact
                        phone={c.phone} email={c.email}
                        onSave={(ph, em) => saveContact(m.name, ph, em)}
                        onCancel={() => setEditingContact(null)}
                      />
                    ) : (
                      <div className="contact-info">
                        {c.phone ? <span>📱 {c.phone}</span> : <span className="contact-empty">📱 cliquer pour ajouter</span>}
                        {c.email ? <a href={`mailto:${c.email}`} onClick={e=>e.stopPropagation()}>✉ {c.email}</a> : <span className="contact-empty">✉ cliquer pour ajouter</span>}
                      </div>
                    )}
                    <span className="contact-idx">{i + 1}</span>
                  </div>
                );
              })}
            </div>

            <div style={{marginTop:"1.2rem",background:"var(--bg2)",border:"1px solid var(--border)",borderRadius:"3px",padding:"1rem"}}>
              <div className="slbl">📋 Contacts utiles sur place</div>
              {[
                { label: "Tatosh (agence cheval)", val: "— à compléter via Henri", icon: "🐎" },
                { label: "Urgences Kirghizistan", val: "112 (police/pompiers) · 103 (ambulance)", icon: "🚨" },
                { label: "Ambassade de France à Bichkek", val: "+996 312 97 31 00", icon: "🇫🇷" },
                { label: "Aéroport Manas (Bichkek)", val: "+996 312 69 30 00", icon: "✈" },
              ].map((c, i) => (
                <div key={i} style={{display:"flex",gap:".6rem",padding:".4rem 0",borderBottom:"1px solid var(--border)",fontSize:".82rem",alignItems:"center"}}>
                  <span style={{fontSize:"1rem"}}>{c.icon}</span>
                  <span style={{color:"var(--muted)",minWidth:"180px"}}>{c.label}</span>
                  <span style={{color:"var(--bone)"}}>{c.val}</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div className="footer">Kirghizistan 2026 · 8 voyageurs · PNR 1NLCW9 · Propulsé par Claude</div>
      </div>
    </>
  );
}

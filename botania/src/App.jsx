import { useState, useEffect, useRef } from "react";
import { PLANT_DB, CATEGORIES } from "./data/plants";
import logoImg from "/logo.png";

// ─── UTILS ───────────────────────────────────────────────────────────────────
const getSeason = (month) => {
  if ([3,4,5].includes(month)) return "spring";
  if ([6,7,8].includes(month)) return "summer";
  if ([9,10,11].includes(month)) return "autumn";
  return "winter";
};

const getSimulatedWeather = () => {
  const month = new Date().getMonth() + 1;
  const temps = {1:5,2:7,3:11,4:14,5:18,6:23,7:26,8:26,9:21,10:15,11:9,12:6};
  const rains = {1:0.6,2:0.5,3:0.5,4:0.4,5:0.3,6:0.2,7:0.1,8:0.1,9:0.3,10:0.5,11:0.6,12:0.6};
  const icons = {1:"🌧",2:"🌥",3:"🌤",4:"⛅",5:"🌤",6:"☀️",7:"☀️",8:"☀️",9:"🌤",10:"🌥",11:"🌧",12:"🌨"};
  return { temp: temps[month], rain: rains[month], icon: icons[month], month };
};

const getDaysUntilWatering = (plant, lastWatered, weather) => {
  const season = getSeason(weather.month);
  const key = season === "spring" || season === "autumn" ? "winter" : season;
  let base = plant.watering[key] || plant.watering.summer || 7;
  if (weather.rain > 0.4 && plant.location !== "intérieur") base = Math.round(base * 1.5);
  const daysPassed = Math.floor((Date.now() - new Date(lastWatered)) / 86400000);
  return Math.max(0, base - daysPassed);
};

const getNotifications = (gardenPlants, weather) => {
  const notifs = [];
  const month = weather.month;
  const season = getSeason(month);
  gardenPlants.forEach(gp => {
    const plant = PLANT_DB.find(p => p.id === gp.plantId);
    if (!plant) return;
    const daysWater = getDaysUntilWatering(plant, gp.lastWatered, weather);
    if (daysWater <= 1) notifs.push({
      id: `water-${gp.id}`, type: "water", plantName: gp.name, emoji: plant.emoji,
      message: daysWater === 0 ? "Arrosage aujourd'hui !" : "Arrosage demain",
      urgency: daysWater === 0 ? "urgent" : "soon", color: "#4FC3F7", gpId: gp.id
    });
    if (plant.fertilizing[season]) {
      const last = new Date(gp.lastFertilized || gp.addedDate);
      const daysPassed = Math.floor((Date.now() - last) / 86400000);
      if (daysPassed >= plant.fertilizing[season] - 2) notifs.push({
        id: `fert-${gp.id}`, type: "fertilize", plantName: gp.name, emoji: plant.emoji,
        message: daysPassed >= plant.fertilizing[season] ? "Fertilisation due !" : "Fertilisation bientôt",
        urgency: daysPassed >= plant.fertilizing[season] ? "urgent" : "soon", color: "#A5D6A7", gpId: gp.id
      });
    }
    if (plant.pruning.months.includes(month)) {
      const daysPassed = Math.floor((Date.now() - new Date(gp.lastPruned || gp.addedDate)) / 86400000);
      if (!plant.pruning.interval || daysPassed >= plant.pruning.interval - 7) notifs.push({
        id: `prune-${gp.id}`, type: "prune", plantName: gp.name, emoji: plant.emoji,
        message: "Période de taille recommandée", urgency: "info", color: "#FFCC80", gpId: gp.id
      });
    }
    if (plant.location === "intérieur/extérieur") {
      const shouldBeIndoor = plant.indoorMonths.includes(month);
      if (shouldBeIndoor && !gp.isIndoor) notifs.push({
        id: `move-${gp.id}`, type: "move", plantName: gp.name, emoji: plant.emoji,
        message: `Rentrer à l'intérieur — ${weather.temp}°C`,
        urgency: weather.temp < plant.tempMin + 3 ? "urgent" : "soon", color: "#CE93D8", gpId: gp.id
      });
      else if (!shouldBeIndoor && gp.isIndoor && weather.temp > plant.tempMin + 5) notifs.push({
        id: `move-${gp.id}`, type: "move", plantName: gp.name, emoji: plant.emoji,
        message: "Sortir à l'extérieur 🌞", urgency: "info", color: "#FFF176", gpId: gp.id
      });
    }
  });
  return notifs;
};

const INITIAL_GARDEN = [
  { id:"gp1", plantId:1, name:"Mon Monstera", addedDate:"2024-03-01", lastWatered: new Date(Date.now()-6*86400000).toISOString(), lastFertilized: new Date(Date.now()-12*86400000).toISOString(), lastPruned: new Date(Date.now()-170*86400000).toISOString(), isIndoor:true },
  { id:"gp2", plantId:4, name:"Orchidée salon", addedDate:"2024-01-15", lastWatered: new Date(Date.now()-5*86400000).toISOString(), lastFertilized: new Date(Date.now()-13*86400000).toISOString(), lastPruned: new Date(Date.now()-100*86400000).toISOString(), isIndoor:true },
  { id:"gp3", plantId:3, name:"Ficus terrasse", addedDate:"2024-05-10", lastWatered: new Date(Date.now()-8*86400000).toISOString(), lastFertilized: new Date(Date.now()-20*86400000).toISOString(), lastPruned: new Date(Date.now()-300*86400000).toISOString(), isIndoor:false },
];

// ─── DIFFICULTY BADGE ─────────────────────────────────────────────────────────
const DiffBadge = ({ d }) => {
  const map = { "très facile": ["#52B788","⭐"], "facile": ["#95D5B2","⭐⭐"], "intermédiaire": ["#FFCC80","⭐⭐⭐"], "difficile": ["#FF8FA3","⭐⭐⭐⭐"] };
  const [color, stars] = map[d] || ["#aaa","?"];
  return <span style={{ fontSize:10, color, marginLeft:4 }}>{stars}</span>;
};

// ─── APP ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [selectedPlant, setSelectedPlant] = useState(null);
  const [gardenPlants, setGardenPlants] = useState(INITIAL_GARDEN);
  const [selectedGP, setSelectedGP] = useState(null);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const weather = getSimulatedWeather();
  const notifications = getNotifications(gardenPlants, weather);
  const urgentCount = notifications.filter(n => n.urgency === "urgent").length;
  const seasonEmoji = { spring:"🌸", summer:"☀️", autumn:"🍂", winter:"❄️" }[getSeason(weather.month)];
  const MONTHS = ["Jan","Fév","Mar","Avr","Mai","Jun","Jul","Aoû","Sep","Oct","Nov","Déc"];

  const showToast = (msg, color = "#52B788") => {
    setToast({ msg, color });
    setTimeout(() => setToast(null), 2500);
  };

  const filteredPlants = PLANT_DB.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase()) || p.family.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "all" ? true
      : category === "intérieur" ? p.location === "intérieur"
      : category === "extérieur" ? p.location === "extérieur"
      : category === "mixte" ? p.location === "intérieur/extérieur"
      : category === "facile" ? (p.difficulty === "facile" || p.difficulty === "très facile")
      : category === "petFriendly" ? p.petFriendly
      : true;
    return matchSearch && matchCat;
  });

  const addToGarden = (plant) => {
    const month = weather.month;
    const newGP = {
      id: `gp${Date.now()}`, plantId: plant.id, name: plant.name,
      addedDate: new Date().toISOString(), lastWatered: new Date().toISOString(),
      lastFertilized: new Date().toISOString(), lastPruned: new Date().toISOString(),
      isIndoor: plant.location === "intérieur" || plant.indoorMonths?.includes(month)
    };
    setGardenPlants(prev => [...prev, newGP]);
    showToast(`${plant.emoji} ${plant.name} ajouté au jardin !`);
    setScreen("garden");
  };

  const markDone = (gpId, action) => {
    setGardenPlants(prev => prev.map(gp => {
      if (gp.id !== gpId) return gp;
      const now = new Date().toISOString();
      if (action === "water") return { ...gp, lastWatered: now };
      if (action === "fertilize") return { ...gp, lastFertilized: now };
      if (action === "prune") return { ...gp, lastPruned: now };
      if (action === "move-in") return { ...gp, isIndoor: true };
      if (action === "move-out") return { ...gp, isIndoor: false };
      return gp;
    }));
    const labels = { water:"💧 Arrosage noté !", fertilize:"🌱 Fertilisation notée !", prune:"✂️ Taille notée !", "move-in":"🏠 Déplacé en intérieur !", "move-out":"🌳 Déplacé en extérieur !" };
    showToast(labels[action] || "✓ Action enregistrée");
    setModal(null);
  };

  const removeFromGarden = (gpId) => {
    setGardenPlants(prev => prev.filter(gp => gp.id !== gpId));
    setModal(null);
    setSelectedGP(null);
    setScreen("garden");
    showToast("Plante retirée du jardin", "#E63946");
  };

  // ── CSS-IN-JS TOKENS ────────────────────────────────────────────────────
  const C = {
    bg: "#0D1810", bg2: "#121f14", card: "#162019", border: "#1d3020",
    green: "#52B788", greenDark: "#2D6A4F", greenLight: "#95D5B2",
    text: "#E8F5E9", textMuted: "#52976E", textDim: "#3a6b48",
    red: "#E63946", amber: "#FFCC80", blue: "#4FC3F7", purple: "#CE93D8",
  };

  const css = {
    app: { fontFamily: "'Georgia', serif", background: C.bg, minHeight:"100vh", maxWidth:430, margin:"0 auto", color: C.text, display:"flex", flexDirection:"column", position:"relative", overflowX:"hidden" },
    // Header
    header: { background: C.bg, borderBottom:`1px solid ${C.border}`, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:50 },
    logoRow: { display:"flex", alignItems:"center", gap:10 },
    logoImg: { width:34, height:34, borderRadius:8, objectFit:"cover" },
    logoText: { fontSize:20, fontWeight:700, color: C.green, letterSpacing:"0.1em", textTransform:"uppercase" },
    weatherPill: { background: C.bg2, border:`1px solid ${C.border}`, borderRadius:20, padding:"4px 12px", fontSize:12, color: C.greenLight, display:"flex", alignItems:"center", gap:5 },
    // Scroll content
    content: { flex:1, overflowY:"auto", paddingBottom:72 },
    // Nav
    nav: { position:"fixed", bottom:0, left:"50%", transform:"translateX(-50%)", width:"100%", maxWidth:430, background: C.bg, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100 },
    navBtn: (active) => ({ flex:1, background:"none", border:"none", color: active ? C.green : C.textDim, cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, fontSize:9, fontFamily:"Georgia, serif", letterSpacing:"0.06em", textTransform:"uppercase", padding:"8px 0 10px", transition:"color 0.2s" }),
    navIcon: { fontSize:18 },
    // Sections
    section: { padding:"16px 18px 0" },
    sectionTitle: { fontSize:11, fontWeight:700, color: C.textMuted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:12 },
    // Cards
    notifCard: (urgency) => ({ background: urgency === "urgent" ? "#1a0d08" : C.card, border:`1px solid ${urgency === "urgent" ? "#5D2E0833" : C.border}`, borderRadius:12, padding:"12px 14px", marginBottom:8, display:"flex", alignItems:"center", gap:10, cursor:"pointer", transition:"opacity 0.15s" }),
    plantCard: (color) => ({ background: C.card, border:`1px solid ${C.border}`, borderTop:`3px solid ${color}`, borderRadius:14, padding:"14px 12px", cursor:"pointer", transition:"transform 0.12s, border-color 0.15s" }),
    gardenCard: { background: C.card, border:`1px solid ${C.border}`, borderRadius:14, padding:"14px 16px", marginBottom:10, display:"flex", alignItems:"center", gap:14, cursor:"pointer" },
    statCard: (color) => ({ background: C.card, borderRadius:12, padding:"12px 14px", flex:1, borderLeft:`3px solid ${color}` }),
    // Buttons
    primaryBtn: { width:"100%", background:`linear-gradient(135deg, ${C.greenDark}, ${C.green})`, border:"none", borderRadius:14, padding:"14px", color:"#fff", fontSize:15, fontWeight:700, fontFamily:"Georgia,serif", cursor:"pointer", letterSpacing:"0.04em" },
    ghostBtn: (color) => ({ background: color+"22", border:`1px solid ${color}44`, borderRadius:20, padding:"7px 14px", fontSize:12, color, fontFamily:"Georgia,serif", cursor:"pointer", fontWeight:600 }),
    infoItem: { background: C.bg2, borderRadius:10, padding:"10px 12px" },
    infoLabel: { fontSize:10, color: C.textMuted, textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:3 },
    infoValue: { fontSize:13, color: C.text, fontWeight:600 },
    badge: (color) => ({ background: color+"22", border:`1px solid ${color}44`, borderRadius:20, fontSize:10, padding:"2px 8px", color, display:"inline-block" }),
    backBtn: { background:"none", border:"none", color: C.green, fontSize:13, fontFamily:"Georgia,serif", cursor:"pointer", padding:"0 0 14px", display:"flex", alignItems:"center", gap:6 },
    tipBox: { background: C.bg2, borderRadius:12, padding:"12px 14px", borderLeft:`3px solid ${C.green}`, marginBottom:16 },
  };

  // ── NOTIF TYPE LABELS ───────────────────────────────────────────────────
  const NT = { water:"💧 Arrosage", fertilize:"🌱 Engrais", prune:"✂️ Taille", move:"🏠 Déplacement" };

  // ══ SCREEN: HOME ═══════════════════════════════════════════════════════════
  const renderHome = () => {
    const season = getSeason(weather.month);
    return (
      <div>
        {/* Hero */}
        <div style={{ background:`linear-gradient(160deg, #0f2412 0%, ${C.bg} 70%)`, padding:"20px 18px 16px", borderBottom:`1px solid ${C.border}` }}>
          <div style={{ fontSize:20, fontWeight:700, color: C.greenLight, marginBottom:3 }}>
            Bonjour, jardinier 🌿
          </div>
          <div style={{ fontSize:13, color: C.textMuted, marginBottom:16 }}>
            {seasonEmoji} {season.charAt(0).toUpperCase()+season.slice(1)} · {weather.icon} {weather.temp}°C
            {weather.rain > 0.4 ? " · Pluie attendue" : ""}
          </div>
          <div style={{ display:"flex", gap:10 }}>
            {[
              [gardenPlants.length, "Plantes", C.green],
              [urgentCount, "Urgents", C.red],
              [notifications.length, "Rappels", C.amber],
            ].map(([n, label, color]) => (
              <div key={label} style={css.statCard(color)}>
                <div style={{ fontSize:22, fontWeight:700, color: C.text }}>{n}</div>
                <div style={{ fontSize:10, color: C.textMuted, textTransform:"uppercase", letterSpacing:"0.06em" }}>{label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Notifications */}
        <div style={css.section}>
          <div style={css.sectionTitle}>Rappels du moment</div>
          {notifications.length === 0 && (
            <div style={{ color: C.textMuted, fontSize:14, padding:"8px 0 16px" }}>Tout est en ordre 🎉 Votre jardin se porte bien.</div>
          )}
          {notifications.map(n => (
            <div key={n.id} style={css.notifCard(n.urgency)} onClick={() => setModal({ type:"action", notif:n })}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:n.color, flexShrink:0 }} />
              <div style={{ fontSize:22, flexShrink:0 }}>{n.emoji}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, color: C.text }}>{n.plantName}</div>
                <div style={{ fontSize:11, color: C.textMuted, marginTop:2 }}>{NT[n.type]} · {n.message}</div>
              </div>
              {n.urgency === "urgent" && (
                <div style={{ background: C.red, color:"#fff", borderRadius:20, fontSize:9, padding:"2px 8px", fontWeight:700 }}>URGENT</div>
              )}
            </div>
          ))}
        </div>

        {/* Quick tip */}
        <div style={{ ...css.section, paddingTop:20 }}>
          <div style={css.sectionTitle}>Conseil de saison</div>
          <div style={css.tipBox}>
            <div style={{ fontSize:13, color: C.greenLight, lineHeight:1.7 }}>
              {getSeason(weather.month) === "spring" && "🌱 Le printemps est le meilleur moment pour rempoter vos plantes. C'est le début de leur période de croissance active."}
              {getSeason(weather.month) === "summer" && "☀️ En été, augmentez la fréquence d'arrosage et protégez vos plantes des coups de chaleur entre 12h et 16h."}
              {getSeason(weather.month) === "autumn" && "🍂 Réduisez progressivement les arrosages et l'engrais. Préparez vos plantes sensibles pour rentrer à l'intérieur."}
              {getSeason(weather.month) === "winter" && "❄️ Vos plantes sont en dormance. Arrosages réduits, pas d'engrais. Attention aux courants d'air froids près des fenêtres."}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ══ SCREEN: SEARCH ═════════════════════════════════════════════════════════
  const renderSearch = () => (
    <div>
      <div style={css.section}>
        <div style={css.sectionTitle}>Explorer — {PLANT_DB.length} espèces</div>
        <input
          style={{ width:"100%", background: C.bg2, border:`1px solid ${C.border}`, borderRadius:12, padding:"11px 16px", color: C.text, fontSize:14, fontFamily:"Georgia,serif", outline:"none", boxSizing:"border-box", marginBottom:12 }}
          placeholder="🔍  Rechercher par nom ou famille..."
          value={search} onChange={e => setSearch(e.target.value)}
        />
        {/* Category pills */}
        <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:4, marginBottom:4 }}>
          {CATEGORIES.map(cat => (
            <button key={cat.id}
              style={{ background: category === cat.id ? C.green+"33" : C.bg2, border:`1px solid ${category === cat.id ? C.green : C.border}`, borderRadius:20, padding:"5px 12px", fontSize:11, color: category === cat.id ? C.green : C.textMuted, fontFamily:"Georgia,serif", cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.15s" }}
              onClick={() => setCategory(cat.id)}>
              {cat.emoji} {cat.label}
            </button>
          ))}
        </div>
        <div style={{ fontSize:11, color: C.textDim, marginTop:6, marginBottom:0 }}>{filteredPlants.length} résultat{filteredPlants.length > 1 ? "s" : ""}</div>
      </div>
      <div style={{ padding:"12px 18px 0", display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        {filteredPlants.map(p => {
          const inGarden = gardenPlants.some(gp => gp.plantId === p.id);
          return (
            <div key={p.id} style={css.plantCard(p.color)}
              onClick={() => { setSelectedPlant(p); setScreen("plant-detail"); }}>
              <div style={{ fontSize:32, marginBottom:8 }}>{p.emoji}</div>
              <div style={{ fontSize:12, fontWeight:700, color: C.text, lineHeight:1.3, marginBottom:3 }}>{p.name}</div>
              <div style={{ fontSize:10, color: C.textDim, fontStyle:"italic" }}>{p.family}</div>
              <div style={{ fontSize:10, color: C.green, marginTop:6 }}>
                {p.location === "intérieur" ? "🏠" : p.location === "extérieur" ? "🌳" : "🔄"} {p.location}
                <DiffBadge d={p.difficulty} />
              </div>
              {p.petFriendly && <div style={{ fontSize:9, color:"#90BE6D", marginTop:3 }}>🐾 Pet-safe</div>}
              {inGarden && <div style={{ fontSize:9, color: C.green, marginTop:3 }}>✓ Dans mon jardin</div>}
            </div>
          );
        })}
      </div>
    </div>
  );

  // ══ SCREEN: PLANT DETAIL ═══════════════════════════════════════════════════
  const renderPlantDetail = () => {
    const p = selectedPlant;
    if (!p) return null;
    const inGarden = gardenPlants.some(gp => gp.plantId === p.id);
    const season = getSeason(weather.month);
    return (
      <div>
        <div style={{ background:`linear-gradient(160deg, ${p.color}25 0%, ${C.bg} 60%)`, padding:"16px 18px 18px", borderBottom:`1px solid ${C.border}` }}>
          <button style={css.backBtn} onClick={() => setScreen("search")}>← Retour</button>
          <div style={{ fontSize:60, marginBottom:12 }}>{p.emoji}</div>
          <div style={{ fontSize:22, fontWeight:700, color: C.text, marginBottom:4 }}>{p.name}</div>
          <div style={{ fontSize:13, color: C.green, fontStyle:"italic", marginBottom:10 }}>{p.family}</div>
          <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
            <span style={css.badge(p.color)}>{p.location === "intérieur" ? "🏠" : p.location === "extérieur" ? "🌳" : "🔄"} {p.location}</span>
            {p.petFriendly && <span style={css.badge("#90BE6D")}>🐾 Pet-friendly</span>}
            {p.toxic && <span style={css.badge(C.red)}>☠️ Toxique</span>}
            <span style={css.badge(C.amber)}>Difficulté : {p.difficulty}</span>
          </div>
        </div>
        <div style={{ padding:"18px 18px 20px" }}>
          <p style={{ fontSize:13, color: C.greenLight, lineHeight:1.7, marginBottom:18 }}>{p.description}</p>
          {/* Info grid */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            {[
              ["💧 Arrosage été", `tous les ${p.watering.summer}j`],
              ["❄️ Arrosage hiver", p.watering.winter ? `tous les ${p.watering.winter}j` : "Aucun"],
              ["🌡️ Temp. min", `${p.tempMin}°C`],
              ["🌡️ Temp. max", `${p.tempMax}°C`],
              ["☀️ Lumière", p.light],
              ["💧 Humidité", p.humidity],
              ["🌱 Engrais saison", p.fertilizing[season] ? `tous les ${p.fertilizing[season]}j` : "Pas en ce moment"],
              ["📍 Habitat", p.location],
            ].map(([label, value]) => (
              <div key={label} style={css.infoItem}>
                <div style={css.infoLabel}>{label}</div>
                <div style={css.infoValue}>{value}</div>
              </div>
            ))}
          </div>
          {/* Pruning months */}
          {p.pruning.months.length > 0 && (
            <div style={{ ...css.infoItem, marginBottom:12 }}>
              <div style={css.infoLabel}>✂️ Mois de taille recommandés</div>
              <div style={{ ...css.infoValue, fontSize:12, marginTop:4 }}>{p.pruning.months.map(m => MONTHS[m-1]).join(", ")}</div>
            </div>
          )}
          {/* Indoor months */}
          {p.location === "intérieur/extérieur" && p.indoorMonths.length > 0 && (
            <div style={{ ...css.infoItem, marginBottom:12 }}>
              <div style={css.infoLabel}>🏠 Mois en intérieur</div>
              <div style={{ ...css.infoValue, fontSize:12, marginTop:4 }}>{p.indoorMonths.map(m => MONTHS[m-1]).join(", ")}</div>
            </div>
          )}
          {/* Tip */}
          <div style={{ ...css.tipBox, marginTop:16 }}>
            <div style={{ fontSize:11, color: C.green, marginBottom:4, fontWeight:700 }}>💡 Conseil d'expert</div>
            <div style={{ fontSize:13, color: C.greenLight, lineHeight:1.7 }}>{p.tips}</div>
          </div>
          {inGarden
            ? <div style={{ ...css.primaryBtn, opacity:0.5, cursor:"default", textAlign:"center" }}>✓ Déjà dans votre jardin</div>
            : <button style={css.primaryBtn} onClick={() => addToGarden(p)}>+ Ajouter à mon jardin</button>
          }
        </div>
      </div>
    );
  };

  // ══ SCREEN: GARDEN ════════════════════════════════════════════════════════
  const renderGarden = () => (
    <div style={css.section}>
      <div style={css.sectionTitle}>Mon Jardin — {gardenPlants.length} plante{gardenPlants.length > 1 ? "s" : ""}</div>
      {gardenPlants.length === 0 && (
        <div style={{ color: C.textMuted, fontSize:14, padding:"20px 0", textAlign:"center" }}>
          <div style={{ fontSize:40, marginBottom:10 }}>🌱</div>
          Votre jardin est vide. Explorez notre base de plantes pour commencer.
          <br /><br />
          <button style={{ ...css.ghostBtn(C.green), padding:"10px 20px", fontSize:13 }} onClick={() => setScreen("search")}>Explorer les plantes</button>
        </div>
      )}
      {gardenPlants.map(gp => {
        const plant = PLANT_DB.find(p => p.id === gp.plantId);
        if (!plant) return null;
        const gpNotifs = notifications.filter(n => n.gpId === gp.id);
        const hasUrgent = gpNotifs.some(n => n.urgency === "urgent");
        const daysWater = getDaysUntilWatering(plant, gp.lastWatered, weather);
        return (
          <div key={gp.id} style={{ ...css.gardenCard, borderColor: hasUrgent ? C.red+"44" : C.border }}
            onClick={() => { setSelectedGP(gp); setScreen("garden-detail"); }}>
            <div style={{ fontSize:38 }}>{plant.emoji}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:14, fontWeight:700, color: C.text }}>{gp.name}</div>
              <div style={{ fontSize:11, color: C.textMuted, fontStyle:"italic" }}>{plant.name}</div>
              <div style={{ marginTop:6, display:"flex", gap:6, flexWrap:"wrap" }}>
                <span style={css.badge(gp.isIndoor ? C.blue : C.green)}>{gp.isIndoor ? "🏠 Intérieur" : "🌳 Extérieur"}</span>
                <span style={css.badge(daysWater === 0 ? C.red : daysWater <= 2 ? C.amber : C.green)}>💧 {daysWater === 0 ? "Aujourd'hui" : `J-${daysWater}`}</span>
              </div>
            </div>
            {gpNotifs.length > 0 && (
              <div style={{ background: hasUrgent ? C.red : C.green, color:"#fff", borderRadius:"50%", width:22, height:22, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, flexShrink:0 }}>
                {gpNotifs.length}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );

  // ══ SCREEN: GARDEN DETAIL ════════════════════════════════════════════════
  const renderGardenDetail = () => {
    const gp = selectedGP;
    if (!gp) return null;
    const plant = PLANT_DB.find(p => p.id === gp.plantId);
    if (!plant) return null;
    const gpNotifs = notifications.filter(n => n.gpId === gp.id);
    const daysWater = getDaysUntilWatering(plant, gp.lastWatered, weather);
    const lastWateredDays = Math.floor((Date.now() - new Date(gp.lastWatered)) / 86400000);
    const lastFertDays = Math.floor((Date.now() - new Date(gp.lastFertilized)) / 86400000);
    return (
      <div style={css.section}>
        <button style={css.backBtn} onClick={() => setScreen("garden")}>← Mon Jardin</button>
        <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:18 }}>
          <div style={{ fontSize:50 }}>{plant.emoji}</div>
          <div>
            <div style={{ fontSize:20, fontWeight:700, color: C.text }}>{gp.name}</div>
            <div style={{ fontSize:12, color: C.green, fontStyle:"italic" }}>{plant.name}</div>
            <span style={{ ...css.badge(gp.isIndoor ? C.blue : C.green), marginTop:6, display:"inline-block" }}>
              {gp.isIndoor ? "🏠 Intérieur" : "🌳 Extérieur"}
            </span>
          </div>
        </div>

        {/* Active notifications */}
        {gpNotifs.length > 0 && (
          <>
            <div style={css.sectionTitle}>⚠️ Rappels actifs</div>
            {gpNotifs.map(n => (
              <div key={n.id} style={{ ...css.notifCard(n.urgency), marginBottom:8 }}>
                <div style={{ width:7, height:7, borderRadius:"50%", background:n.color, flexShrink:0 }} />
                <div style={{ fontSize:20 }}>{n.emoji}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:700, color: C.text }}>{NT[n.type]}</div>
                  <div style={{ fontSize:11, color: C.textMuted }}>{n.message}</div>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Stats */}
        <div style={css.sectionTitle}>Suivi</div>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
          {[
            ["💧 Dernier arrosage", `Il y a ${lastWateredDays}j`],
            ["💧 Prochain arrosage", daysWater === 0 ? "Aujourd'hui !" : `Dans ${daysWater}j`],
            ["🌱 Dernière fertilisation", `Il y a ${lastFertDays}j`],
            ["📅 Ajouté le", new Date(gp.addedDate).toLocaleDateString("fr-FR")],
          ].map(([label, value]) => (
            <div key={label} style={css.infoItem}>
              <div style={css.infoLabel}>{label}</div>
              <div style={{ ...css.infoValue, color: label.includes("Prochain") && daysWater === 0 ? C.red : C.text }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={css.sectionTitle}>Actions rapides</div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          <button style={css.ghostBtn(C.blue)} onClick={() => markDone(gp.id, "water")}>💧 Arrosé</button>
          <button style={css.ghostBtn("#A5D6A7")} onClick={() => markDone(gp.id, "fertilize")}>🌱 Fertilisé</button>
          <button style={css.ghostBtn(C.amber)} onClick={() => markDone(gp.id, "prune")}>✂️ Taillé</button>
          {plant.location === "intérieur/extérieur" && (
            gp.isIndoor
              ? <button style={css.ghostBtn("#FFF176")} onClick={() => markDone(gp.id, "move-out")}>🌳 Sortir dehors</button>
              : <button style={css.ghostBtn(C.purple)} onClick={() => markDone(gp.id, "move-in")}>🏠 Rentrer</button>
          )}
        </div>

        {/* View plant sheet */}
        <button style={{ ...css.ghostBtn(C.green), width:"100%", textAlign:"center", padding:"10px", marginBottom:10 }}
          onClick={() => { setSelectedPlant(plant); setScreen("plant-detail"); }}>
          📋 Voir la fiche technique
        </button>

        {/* Delete */}
        <button style={{ background:"none", border:`1px solid ${C.red}44`, borderRadius:20, padding:"8px 16px", fontSize:12, color: C.red, fontFamily:"Georgia,serif", cursor:"pointer", marginTop:8 }}
          onClick={() => setModal({ type:"delete", gpId:gp.id, name:gp.name })}>
          🗑 Supprimer du jardin
        </button>
      </div>
    );
  };

  // ── MODAL ────────────────────────────────────────────────────────────────
  const renderModal = () => {
    if (!modal) return null;
    const ACT = {
      water: { label:"Marquer comme arrosé", color: C.blue, action:"water" },
      fertilize: { label:"Marquer comme fertilisé", color:"#A5D6A7", action:"fertilize" },
      prune: { label:"Marquer comme taillé", color: C.amber, action:"prune" },
      move: { label: modal.notif?.message?.includes("Rentrer") ? "Marquer comme rentré" : "Marquer comme sorti", color: C.purple, action: modal.notif?.message?.includes("Rentrer") ? "move-in" : "move-out" },
    };
    return (
      <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)", zIndex:200, display:"flex", alignItems:"flex-end" }}
        onClick={() => setModal(null)}>
        <div style={{ background: C.card, borderRadius:"20px 20px 0 0", padding:"24px 18px 40px", width:"100%", maxWidth:430, margin:"0 auto", borderTop:`1px solid ${C.border}` }}
          onClick={e => e.stopPropagation()}>
          {modal.type === "delete" ? (
            <>
              <div style={{ fontSize:18, fontWeight:700, color: C.text, marginBottom:8 }}>Supprimer "{modal.name}" ?</div>
              <div style={{ fontSize:13, color: C.textMuted, marginBottom:22 }}>Cette plante sera retirée de votre jardin et ses rappels supprimés.</div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ flex:1, background: C.bg2, border:"none", borderRadius:12, padding:14, color: C.green, fontSize:14, fontFamily:"Georgia,serif", cursor:"pointer" }} onClick={() => setModal(null)}>Annuler</button>
                <button style={{ flex:1, background: C.red, border:"none", borderRadius:12, padding:14, color:"#fff", fontSize:14, fontWeight:700, fontFamily:"Georgia,serif", cursor:"pointer" }} onClick={() => removeFromGarden(modal.gpId)}>Supprimer</button>
              </div>
            </>
          ) : modal.type === "action" && modal.notif ? (
            <>
              <div style={{ fontSize:36, marginBottom:10 }}>{modal.notif.emoji}</div>
              <div style={{ fontSize:17, fontWeight:700, color: C.text, marginBottom:6 }}>{modal.notif.plantName}</div>
              <div style={{ fontSize:13, color: C.textMuted, marginBottom:22 }}>{NT[modal.notif.type]} · {modal.notif.message}</div>
              <div style={{ display:"flex", gap:10 }}>
                <button style={{ flex:1, background: C.bg2, border:"none", borderRadius:12, padding:14, color: C.green, fontSize:13, fontFamily:"Georgia,serif", cursor:"pointer" }} onClick={() => setModal(null)}>Ignorer</button>
                <button style={{ flex:1, background: ACT[modal.notif.type]?.color || C.green, border:"none", borderRadius:12, padding:14, color: "#fff", fontSize:13, fontWeight:700, fontFamily:"Georgia,serif", cursor:"pointer" }}
                  onClick={() => markDone(modal.notif.gpId, ACT[modal.notif.type]?.action)}>
                  {ACT[modal.notif.type]?.label}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  // ── TOAST ────────────────────────────────────────────────────────────────
  const renderToast = () => toast && (
    <div style={{ position:"fixed", bottom:80, left:"50%", transform:"translateX(-50%)", background: toast.color, color:"#fff", borderRadius:12, padding:"10px 18px", fontSize:13, fontWeight:600, zIndex:300, whiteSpace:"nowrap", boxShadow:"0 4px 20px rgba(0,0,0,0.3)", transition:"opacity 0.3s" }}>
      {toast.msg}
    </div>
  );

  return (
    <div style={css.app}>
      {/* Header */}
      <div style={css.header}>
        <div style={css.logoRow}>
          <img src={logoImg} alt="Botania" style={css.logoImg} />
          <span style={css.logoText}>Botania</span>
        </div>
        <div style={css.weatherPill}>{weather.icon} {weather.temp}°C</div>
      </div>

      {/* Content */}
      <div style={css.content}>
        {screen === "home" && renderHome()}
        {screen === "search" && renderSearch()}
        {screen === "plant-detail" && renderPlantDetail()}
        {screen === "garden" && renderGarden()}
        {screen === "garden-detail" && renderGardenDetail()}
      </div>

      {/* Bottom Nav */}
      <div style={css.nav}>
        {[
          { id:"home", icon:"🏡", label:"Accueil", badge: urgentCount },
          { id:"search", icon:"🔍", label:"Explorer" },
          { id:"garden", icon:"🌿", label:"Jardin" },
        ].map(item => (
          <button key={item.id}
            style={css.navBtn(screen === item.id || (screen === "garden-detail" && item.id === "garden") || (screen === "plant-detail" && item.id === "search"))}
            onClick={() => setScreen(item.id)}>
            <span style={{ position:"relative" }}>
              <span style={css.navIcon}>{item.icon}</span>
              {item.badge > 0 && (
                <span style={{ position:"absolute", top:-4, right:-8, background: C.red, color:"#fff", borderRadius:"50%", width:14, height:14, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700 }}>
                  {item.badge}
                </span>
              )}
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </div>

      {renderModal()}
      {renderToast()}
    </div>
  );
}

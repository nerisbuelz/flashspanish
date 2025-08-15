
(() => {
  const { useState, useEffect, useMemo, useRef } = React;

  // ---- Local Storage helpers ----
  const LS_KEY = "flashspanish.cards.v1";
  const LS_STATS = "flashspanish.stats.v1";
  const loadJSON = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

  // ---- Models ----
  function uuid() { return crypto.randomUUID ? crypto.randomUUID() : (Date.now()+"-"+Math.random()); }

  function seed() {
    return [
      mk("colazione", "desayuno", "Hago el desayuno a las 8.", "Cibo"),
      mk("pranzo", "almuerzo", "", "Cibo"),
      mk("cena", "cena", "Cenamos tarde en España.", "Cibo"),
      mk("bere", "beber", "¿Quieres beber agua?", "Verbi"),
      mk("camminare", "caminar", "Me gusta caminar por el parque.", "Verbi"),
      mk("zaino", "mochila", "La mochila es pesada.", "Viaggi"),
      mk("biglietto", "billete", "Billete de tren.", "Viaggi"),
    ];
  }

  function mk(front, back, notes="", category=null){
    const now = new Date().toISOString();
    return {
      id: uuid(),
      front, back, notes,
      category,
      createdAt: now,
      dueDate: now,
      intervalDays: 0,
      repetitions: 0,
      easeFactor: 2.5
    };
  }

  function isDue(card) { return new Date(card.dueDate) <= new Date(); }

  // ---- SRS (SM-2 lite) ----
  const Grade = { again:0, hard:1, good:2, easy:3 };
  function review(card, grade) {
    let ef = card.easeFactor, reps = card.repetitions, interval = card.intervalDays;
    switch(grade){
      case Grade.again:
        reps = 0; interval = 1; ef = Math.max(1.3, ef - 0.20); break;
      case Grade.hard:
        ef = Math.max(1.3, ef - 0.15); interval = Math.max(1, Math.floor(Math.max(1, interval)*0.5)); break;
      case Grade.good:
        reps += 1;
        if (reps === 1) interval = 1;
        else if (reps === 2) interval = 6;
        else interval = Math.max(1, Math.round(Math.max(1, interval)*ef));
        break;
      case Grade.easy:
        reps += 1; ef = ef + 0.15;
        if (reps <= 1) interval = 3;
        else interval = Math.max(1, Math.round(Math.max(1, interval)*ef) + 1);
        break;
    }
    const next = new Date(); next.setDate(next.getDate() + interval);
    return { ...card, repetitions: reps, intervalDays: interval, easeFactor: ef, dueDate: next.toISOString() };
  }

  // ---- Stats ----
  function todayKey(d=new Date()){
    const y=d.getFullYear(), m=String(d.getMonth()+1).padStart(2,'0'), da=String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${da}`;
  }

  // ---- TTS ----
  function speak(text, lang="es-ES"){
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      speechSynthesis.speak(u);
    } catch(e){ console.warn("TTS non disponibile", e); }
  }

  // ---- CSV Parse (simple) ----
  function parseCSV(text){
    // naive split on \n and commas; ignores quoted commas for simplicity
    return text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(l => l.split(",").map(s => s.trim()));
  }

  // ---- App ----
  function App(){
    const [tab, setTab] = useState("study"); // study | add | deck
    const [cards, setCards] = useState(() => loadJSON(LS_KEY, seed()));
    const [stats, setStats] = useState(() => loadJSON(LS_STATS, {}));
    const [search, setSearch] = useState("");
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [showBack, setShowBack] = useState(false);
    const [currentId, setCurrentId] = useState(null);

    useEffect(() => saveJSON(LS_KEY, cards), [cards]);
    useEffect(() => saveJSON(LS_STATS, stats), [stats]);

    const dueCards = useMemo(() => cards.filter(isDue).sort((a,b)=> new Date(a.dueDate)-new Date(b.dueDate)), [cards]);
    const current = useMemo(() => {
      let c = cards.find(c => c.id === currentId);
      if(!c) c = dueCards[0];
      return c || null;
    }, [cards, currentId, dueCards]);

    // Stats computed
    const tk = todayKey();
    const todayStats = stats[tk] || { reviewed:0, added:0 };

    function addCard(front, back, notes, category){
      const c = mk(front, back, notes || "", category || null);
      setCards(prev => [c, ...prev]);
      const tk = todayKey();
      setStats(s => ({ ...s, [tk]: { ...(s[tk]||{reviewed:0,added:0}), added: (s[tk]?.added||0)+1 }}));
    }

    function updateCard(updated){
      setCards(prev => prev.map(c => c.id === updated.id ? updated : c));
    }

    function removeCard(id){
      setCards(prev => prev.filter(c => c.id !== id));
    }

    function grade(g){
      if(!current) return;
      const nextCard = review(current, g);
      updateCard(nextCard);
      setShowBack(false);
      setCurrentId(null);
      setStats(s => ({ ...s, [tk]: { ...(s[tk]||{reviewed:0,added:0}), reviewed: (s[tk]?.reviewed||0)+1 }}));
    }

    function resetSRS(card){
      updateCard({ ...card, intervalDays:0, repetitions:0, easeFactor:2.5, dueDate: new Date().toISOString() });
    }

    const categories = useMemo(() => {
      const set = new Set(cards.filter(c => c.category).map(c => c.category));
      return Array.from(set).sort();
    }, [cards]);

    // Filtered list
    const filtered = useMemo(() => {
      const base = categoryFilter ? cards.filter(c => c.category === categoryFilter) : cards;
      if(!search.trim()) return base;
      const q = search.toLowerCase();
      return base.filter(c => c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q));
    }, [cards, search, categoryFilter]);

    // Components
    return React.createElement('div', {className:'container'},
      React.createElement(Header, {tab, setTab, todayStats}),
      tab==='study' && React.createElement(StudyView, {current, showBack, setShowBack, grade, speak}),
      tab==='add' && React.createElement(AddView, {addCard, categories}),
      tab==='deck' && React.createElement(DeckView, {cards: filtered, categories, setCategoryFilter, categoryFilter, search, setSearch, resetSRS, removeCard})
    );
  }

  function Header({tab, setTab, todayStats}){
    return React.createElement('div', {className:'header'},
      React.createElement('h1', null, 'FlashSpanish Web'),
      React.createElement('div', {className:'tabs'},
        React.createElement('button', {className:`tab ${tab==='study'?'active':''}`, onClick:()=>setTab('study')}, 'Ripasso'),
        React.createElement('button', {className:`tab ${tab==='add'?'active':''}`, onClick:()=>setTab('add')}, 'Aggiungi'),
        React.createElement('button', {className:`tab ${tab==='deck'?'active':''}`, onClick:()=>setTab('deck')}, 'Mazzo')
      ),
      React.createElement('div', {className:'small'}, `Oggi: ${todayStats.reviewed||0} riv, ${todayStats.added||0} agg`)
    );
  }

  function StudyView({current, showBack, setShowBack, grade, speak}){
    if(!current){
      return React.createElement('div', {className:'grid', style:{marginTop:12}},
        React.createElement('div', {className:'section'},
          React.createElement('p', null, 'Tutto ripassato per ora! Aggiungi nuove carte o importa da CSV in "Aggiungi".')
        )
      );
    }
    return React.createElement('div', {className:'grid', style:{gap:16, marginTop:12}},
      React.createElement('div', {className:'card', onClick:()=>setShowBack(!showBack), role:'button', 'aria-label':'flip'},
        React.createElement('div', {className:'subtitle'}, showBack ? 'Español' : 'Italiano'),
        React.createElement('div', {className:'word'}, showBack ? current.back : current.front)
      ),
      showBack ? React.createElement('div', {className:'actions'},
        React.createElement('button', {className:'btn', onClick:(e)=>{e.stopPropagation(); speak(current.back);}}, 'Pronuncia'),
        React.createElement('button', {className:'btn danger', onClick:(e)=>{e.stopPropagation(); grade(0);}}, 'Dimenticato'),
        React.createElement('button', {className:'btn', onClick:(e)=>{e.stopPropagation(); grade(1);}}, 'Dubbio'),
        React.createElement('button', {className:'btn primary', onClick:(e)=>{e.stopPropagation(); grade(2);}}, 'Ricordato'),
        React.createElement('button', {className:'btn', onClick:(e)=>{e.stopPropagation(); grade(3);}}, 'Facile')
      ) : React.createElement('div', {className:'small', style:{textAlign:'center'}}, 'Tocca la carta per vedere la risposta')
    );
  }

  function AddView({addCard, categories}){
    const [front, setFront] = useState("");
    const [back, setBack] = useState("");
    const [notes, setNotes] = useState("");
    const [cat, setCat] = useState("");
    const fileRef = useRef();

    function onAdd(){
      if(!front.trim() || !back.trim()) return;
      addCard(front.trim(), back.trim(), notes.trim(), cat.trim() || null);
      setFront(""); setBack(""); setNotes("");
    }

    function onPickCSV(e){
      const file = e.target.files[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCSV(String(reader.result));
        rows.forEach(cols => {
          const [f,b,n] = cols;
          if(f && b) addCard(f, b, n||"", cat.trim() || null);
        });
        alert(`Import completato: ${rows.length} righe`);
      };
      reader.readAsText(file, 'utf-8');
      e.target.value = '';
    }

    return React.createElement('div', {className:'grid grid-2', style:{marginTop:12}},
      React.createElement('div', {className:'section'},
        React.createElement('label', null, 'Fronte (Italiano)'),
        React.createElement('input', {value:front, onChange:e=>setFront(e.target.value), placeholder:'es. colazione'}),
        React.createElement('label', {style:{marginTop:10}}, 'Retro (Español)'),
        React.createElement('input', {value:back, onChange:e=>setBack(e.target.value), placeholder:'es. desayuno'}),
        React.createElement('label', {style:{marginTop:10}}, 'Note (opzionale)'),
        React.createElement('textarea', {value:notes, onChange:e=>setNotes(e.target.value), rows:3, placeholder:'frase o appunti'}),
        React.createElement('label', {style:{marginTop:10}}, 'Categoria (opzionale)'),
        React.createElement('input', {list:'cats', value:cat, onChange:e=>setCat(e.target.value), placeholder:'es. Cibo'}),
        React.createElement('datalist', {id:'cats'}, categories.map(c => React.createElement('option', {key:c, value:c}))),
        React.createElement('div', {className:'actions', style:{marginTop:10}},
          React.createElement('button', {className:'btn primary', onClick:onAdd}, 'Aggiungi Carta'),
          React.createElement('button', {className:'btn', onClick:()=>fileRef.current.click()}, 'Importa da CSV'),
          React.createElement('input', {type:'file', accept:'.csv,text/csv', style:{display:'none'}, ref:fileRef, onChange:onPickCSV})
        )
      ),
      React.createElement('div', {className:'section'},
        React.createElement('p', {className:'small'}, 'Formato CSV: "fronte,retro,nota" (una riga per carta). Esempio:'),
        React.createElement('pre', {className:'small'}, 'colazione,desayuno,Hago el desayuno a las 8.\\npranzo,almuerzo,\\ncamminare,caminar,Me gusta caminar por el parque.'),
        React.createElement('p', {className:'small'}, 'Suggerimento: imposta una Categoria prima di importare per assegnarla a tutte le righe.')
      )
    );
  }

  function DeckView({cards, categories, setCategoryFilter, categoryFilter, search, setSearch, resetSRS, removeCard}){
    return React.createElement('div', {className:'grid', style:{gap:12, marginTop:12}},
      React.createElement('div', {className:'grid grid-2'},
        React.createElement('div', {className:'section'},
          React.createElement('label', null, 'Cerca'),
          React.createElement('input', {value:search, onChange:e=>setSearch(e.target.value), placeholder:'fronte o retro...'})
        ),
        React.createElement('div', {className:'section'},
          React.createElement('label', null, 'Categoria'),
          React.createElement('select', {value:categoryFilter||'', onChange:e=>setCategoryFilter(e.target.value||null)},
            React.createElement('option', {value:''}, 'Tutte'),
            categories.map(c => React.createElement('option', {key:c, value:c}, c))
          )
        )
      ),
      React.createElement('div', {className:'section'},
        React.createElement('ul', {className:'list'},
          cards.map(card => React.createElement('li', {key:card.id, className:'item'},
            React.createElement('div', null,
              React.createElement('div', null, React.createElement('strong', null, card.front), " → ", card.back),
              React.createElement('div', {className:'small'},
                card.category ? React.createElement('span', {className:'tag'}, card.category) : null,
                "  • Prossima: ", new Date(card.dueDate).toLocaleDateString()
              ),
              card.notes ? React.createElement('div', {className:'small'}, card.notes) : null
            ),
            React.createElement('div', {className:'actions'},
              React.createElement('button', {className:'btn', onClick:()=>resetSRS(card)}, 'Reset SRS'),
              React.createElement('button', {className:'btn danger', onClick:()=>removeCard(card.id)}, 'Elimina')
            )
          ))
        )
      ),
      React.createElement('div', {className:'footer'}, 'Suggerimento: condividi questa app caricandola su GitHub Pages o Netlify.')
    );
  }

  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(React.createElement(App));
})();

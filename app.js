import React, { useState, useEffect } from 'react';

function App() {
  const [flashcards, setFlashcards] = useState([]);
  const [filteredCards, setFilteredCards] = useState([]);
  const [language, setLanguage] = useState('es'); // 'es' = spagnolo, 'it' = italiano
  const [category, setCategory] = useState('tutte');
  const [difficulty, setDifficulty] = useState('tutti');

  useEffect(() => {
    // Sostituisci con il tuo link Raw GitHub
    fetch('https://raw.githubusercontent.com/NOMEUTENTE/NOMEREPO/main/vocabulario.json')
      .then(response => response.json())
      .then(data => {
        setFlashcards(data);
        setFilteredCards(data);
      })
      .catch(err => console.error('Errore nel caricamento JSON:', err));
  }, []);

  useEffect(() => {
    let cards = [...flashcards];

    // Filtra per categoria
    if (category !== 'tutte') {
      cards = cards.filter(card => card.category === category);
    }

    // Filtra per difficoltà
    if (difficulty !== 'tutti') {
      cards = cards.filter(card => card.level === difficulty);
    }

    setFilteredCards(cards);
  }, [category, difficulty, flashcards]);

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Flashcards Spagnolo</h1>

      {/* Selezione lingua */}
      <div>
        <label>Lingua da leggere: </label>
        <select value={language} onChange={e => setLanguage(e.target.value)}>
          <option value="es">Spagnolo → Italiano</option>
          <option value="it">Italiano → Spagnolo</option>
        </select>
      </div>

      {/* Selezione categoria */}
      <div>
        <label>Categoria: </label>
        <select value={category} onChange={e => setCategory(e.target.value)}>
          <option value="tutte">Tutte</option>
          <option value="verbi">Verbi</option>
          <option value="oggetti">Oggetti</option>
          <option value="modi di dire">Modi di dire</option>
          {/* Aggiungi altre categorie presenti nel tuo JSON */}
        </select>
      </div>

      {/* Selezione difficoltà */}
      <div>
        <label>Difficoltà: </label>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
          <option value="tutti">Tutti</option>
          <option value="facile">Facile</option>
          <option value="intermedio">Intermedio</option>
          <option value="avanzato">Avanzato</option>
        </select>
      </div>

      <hr />

      {/* Visualizzazione flashcards */}
      <div>
        {filteredCards.map((card, index) => (
          <div key={index} style={{ border: '1px solid #ccc', padding: '10px', margin: '5px' }}>
            {language === 'es' ? (
              <>
                <strong>{card.spanish}</strong> → {card.italian}
              </>
            ) : (
              <>
                <strong>{card.italian}</strong> → {card.spanish}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;

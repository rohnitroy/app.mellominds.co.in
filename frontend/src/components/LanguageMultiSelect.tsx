import React, { useState, useRef, useEffect } from 'react';
import styles from './LanguageMultiSelect.module.css';

const ALL_LANGUAGES = [
  'Afrikaans','Albanian','Amharic','Arabic','Aragonese','Armenian','Assamese','Azerbaijani',
  'Basque','Belarusian','Bengali','Bosnian','Breton','Bulgarian','Burmese',
  'Catalan','Cebuano','Chichewa','Chinese (Simplified)','Chinese (Traditional)','Corsican','Croatian','Czech',
  'Danish','Dutch',
  'English','Esperanto','Estonian',
  'Faroese','Fijian','Finnish','French','Frisian',
  'Galician','Georgian','German','Greek','Gujarati',
  'Haitian Creole','Hausa','Hawaiian','Hebrew','Hindi','Hmong','Hungarian',
  'Icelandic','Igbo','Indonesian','Irish','Italian',
  'Japanese','Javanese',
  'Kannada','Kazakh','Khmer','Kinyarwanda','Korean','Kurdish','Kyrgyz',
  'Lao','Latin','Latvian','Lithuanian','Luxembourgish',
  'Macedonian','Malagasy','Malay','Malayalam','Maltese','Maori','Marathi','Mongolian',
  'Nepali','Norwegian',
  'Odia','Pashto','Persian','Polish','Portuguese','Punjabi',
  'Romanian','Russian',
  'Samoan','Scots Gaelic','Serbian','Sesotho','Shona','Sindhi','Sinhala','Slovak','Slovenian','Somali','Spanish','Sundanese','Swahili','Swedish',
  'Tajik','Tamil','Tatar','Telugu','Thai','Turkish','Turkmen',
  'Ukrainian','Urdu','Uyghur','Uzbek',
  'Vietnamese',
  'Welsh','Xhosa','Yiddish','Yoruba','Zulu'
];

interface LanguageMultiSelectProps {
  value: string;           // comma-separated string e.g. "English, Hindi"
  onChange: (value: string) => void;
}

const LanguageMultiSelect: React.FC<LanguageMultiSelectProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected: string[] = value
    ? value.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (lang: string) => {
    const next = selected.includes(lang)
      ? selected.filter(l => l !== lang)
      : [...selected, lang];
    onChange(next.join(', '));
  };

  const remove = (lang: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(selected.filter(l => l !== lang).join(', '));
  };

  const filtered = ALL_LANGUAGES.filter(l =>
    l.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.wrapper} ref={ref}>
      <div className={styles.control} onClick={() => setOpen(o => !o)}>
        <div className={styles.tags}>
          {selected.length === 0 && (
            <span className={styles.placeholder}>Select languages…</span>
          )}
          {selected.map(lang => (
            <span key={lang} className={styles.tag}>
              {lang}
              <button
                type="button"
                className={styles.tagRemove}
                onClick={(e) => remove(lang, e)}
              >×</button>
            </span>
          ))}
        </div>
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <input
              autoFocus
              className={styles.search}
              placeholder="Search language…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <ul className={styles.list}>
            {filtered.length === 0 && (
              <li className={styles.empty}>No languages found</li>
            )}
            {filtered.map(lang => (
              <li
                key={lang}
                className={`${styles.item} ${selected.includes(lang) ? styles.selected : ''}`}
                onClick={() => toggle(lang)}
              >
                <span className={styles.check}>{selected.includes(lang) ? '✓' : ''}</span>
                {lang}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default LanguageMultiSelect;

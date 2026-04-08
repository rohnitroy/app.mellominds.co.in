import React, { useState, useRef, useEffect } from 'react';
import styles from './CountrySelect.module.css'; // reuse same styles

const STATES_BY_COUNTRY: Record<string, string[]> = {
  India: [
    'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh',
    'Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka',
    'Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram',
    'Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana',
    'Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
    'Andaman and Nicobar Islands','Chandigarh','Dadra and Nagar Haveli and Daman and Diu',
    'Delhi','Jammu and Kashmir','Ladakh','Lakshadweep','Puducherry',
  ],
  'United States': [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada',
    'New Hampshire','New Jersey','New Mexico','New York','North Carolina',
    'North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island',
    'South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont',
    'Virginia','Washington','West Virginia','Wisconsin','Wyoming',
  ],
  'United Kingdom': [
    'England','Scotland','Wales','Northern Ireland',
  ],
  Canada: [
    'Alberta','British Columbia','Manitoba','New Brunswick',
    'Newfoundland and Labrador','Northwest Territories','Nova Scotia','Nunavut',
    'Ontario','Prince Edward Island','Quebec','Saskatchewan','Yukon',
  ],
  Australia: [
    'Australian Capital Territory','New South Wales','Northern Territory',
    'Queensland','South Australia','Tasmania','Victoria','Western Australia',
  ],
  'United Arab Emirates': [
    'Abu Dhabi','Ajman','Dubai','Fujairah','Ras Al Khaimah','Sharjah','Umm Al Quwain',
  ],
  Germany: [
    'Baden-Württemberg','Bavaria','Berlin','Brandenburg','Bremen','Hamburg',
    'Hesse','Lower Saxony','Mecklenburg-Vorpommern','North Rhine-Westphalia',
    'Rhineland-Palatinate','Saarland','Saxony','Saxony-Anhalt',
    'Schleswig-Holstein','Thuringia',
  ],
  France: [
    'Auvergne-Rhône-Alpes','Bourgogne-Franche-Comté','Brittany','Centre-Val de Loire',
    'Corsica','Grand Est','Hauts-de-France','Île-de-France','Normandy',
    'Nouvelle-Aquitaine','Occitanie','Pays de la Loire',"Provence-Alpes-Côte d'Azur",
  ],
  Brazil: [
    'Acre','Alagoas','Amapá','Amazonas','Bahia','Ceará','Distrito Federal',
    'Espírito Santo','Goiás','Maranhão','Mato Grosso','Mato Grosso do Sul',
    'Minas Gerais','Pará','Paraíba','Paraná','Pernambuco','Piauí',
    'Rio de Janeiro','Rio Grande do Norte','Rio Grande do Sul','Rondônia',
    'Roraima','Santa Catarina','São Paulo','Sergipe','Tocantins',
  ],
  Pakistan: [
    'Azad Kashmir','Balochistan','Gilgit-Baltistan','Islamabad Capital Territory',
    'Khyber Pakhtunkhwa','Punjab','Sindh',
  ],
  'South Africa': [
    'Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo',
    'Mpumalanga','North West','Northern Cape','Western Cape',
  ],
  Nigeria: [
    'Abia','Adamawa','Akwa Ibom','Anambra','Bauchi','Bayelsa','Benue','Borno',
    'Cross River','Delta','Ebonyi','Edo','Ekiti','Enugu','FCT','Gombe','Imo',
    'Jigawa','Kaduna','Kano','Katsina','Kebbi','Kogi','Kwara','Lagos','Nasarawa',
    'Niger','Ogun','Ondo','Osun','Oyo','Plateau','Rivers','Sokoto','Taraba',
    'Yobe','Zamfara',
  ],
  Mexico: [
    'Aguascalientes','Baja California','Baja California Sur','Campeche','Chiapas',
    'Chihuahua','Coahuila','Colima','Durango','Guanajuato','Guerrero','Hidalgo',
    'Jalisco','Mexico City','Mexico State','Michoacán','Morelos','Nayarit',
    'Nuevo León','Oaxaca','Puebla','Querétaro','Quintana Roo','San Luis Potosí',
    'Sinaloa','Sonora','Tabasco','Tamaulipas','Tlaxcala','Veracruz','Yucatán','Zacatecas',
  ],
};

interface StateSelectProps {
  country: string;
  value: string;
  onChange: (value: string) => void;
}

const StateSelect: React.FC<StateSelectProps> = ({ country, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const states = STATES_BY_COUNTRY[country] || [];
  const hasStates = states.length > 0;

  // Reset state when country changes and current value isn't in new list
  useEffect(() => {
    if (hasStates && value && !states.includes(value)) {
      onChange('');
    }
  }, [country]);

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

  if (!hasStates) {
    return (
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="Enter state / province"
        style={{
          padding: '12px 16px',
          border: '1px solid #00000080',
          borderRadius: '8px',
          fontFamily: "'Urbanist', sans-serif",
          fontWeight: 500,
          fontSize: '15px',
          color: '#050505',
          background: 'white',
          width: '100%',
          boxSizing: 'border-box',
        }}
      />
    );
  }

  const filtered = states.filter(s =>
    s.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.wrapper} ref={ref}>
      <div className={styles.control} onClick={() => setOpen(o => !o)}>
        {value ? (
          <span className={styles.selected}>{value}</span>
        ) : (
          <span className={styles.placeholder}>Select state…</span>
        )}
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <input
              autoFocus
              className={styles.search}
              placeholder="Search state…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <ul className={styles.list}>
            {filtered.length === 0 && (
              <li className={styles.empty}>No states found</li>
            )}
            {filtered.map(state => (
              <li
                key={state}
                className={`${styles.item} ${value === state ? styles.active : ''}`}
                onClick={() => { onChange(state); setOpen(false); setSearch(''); }}
              >
                {state}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default StateSelect;

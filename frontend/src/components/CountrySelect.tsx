import React, { useState, useRef, useEffect } from 'react';
import styles from './CountrySelect.module.css';

interface Country {
  name: string;
  flag: string;
  code: string;
}

const COUNTRIES: Country[] = [
  { name: 'Afghanistan', flag: '🇦🇫', code: 'AF' },
  { name: 'Albania', flag: '🇦🇱', code: 'AL' },
  { name: 'Algeria', flag: '🇩🇿', code: 'DZ' },
  { name: 'Andorra', flag: '🇦🇩', code: 'AD' },
  { name: 'Angola', flag: '🇦🇴', code: 'AO' },
  { name: 'Argentina', flag: '🇦🇷', code: 'AR' },
  { name: 'Armenia', flag: '🇦🇲', code: 'AM' },
  { name: 'Australia', flag: '🇦🇺', code: 'AU' },
  { name: 'Austria', flag: '🇦🇹', code: 'AT' },
  { name: 'Azerbaijan', flag: '🇦🇿', code: 'AZ' },
  { name: 'Bahamas', flag: '🇧🇸', code: 'BS' },
  { name: 'Bahrain', flag: '🇧🇭', code: 'BH' },
  { name: 'Bangladesh', flag: '🇧🇩', code: 'BD' },
  { name: 'Belarus', flag: '🇧🇾', code: 'BY' },
  { name: 'Belgium', flag: '🇧🇪', code: 'BE' },
  { name: 'Belize', flag: '🇧🇿', code: 'BZ' },
  { name: 'Benin', flag: '🇧🇯', code: 'BJ' },
  { name: 'Bhutan', flag: '🇧🇹', code: 'BT' },
  { name: 'Bolivia', flag: '🇧🇴', code: 'BO' },
  { name: 'Bosnia and Herzegovina', flag: '🇧🇦', code: 'BA' },
  { name: 'Botswana', flag: '🇧🇼', code: 'BW' },
  { name: 'Brazil', flag: '🇧🇷', code: 'BR' },
  { name: 'Brunei', flag: '🇧🇳', code: 'BN' },
  { name: 'Bulgaria', flag: '🇧🇬', code: 'BG' },
  { name: 'Burkina Faso', flag: '🇧🇫', code: 'BF' },
  { name: 'Burundi', flag: '🇧🇮', code: 'BI' },
  { name: 'Cambodia', flag: '🇰🇭', code: 'KH' },
  { name: 'Cameroon', flag: '🇨🇲', code: 'CM' },
  { name: 'Canada', flag: '🇨🇦', code: 'CA' },
  { name: 'Cape Verde', flag: '🇨🇻', code: 'CV' },
  { name: 'Central African Republic', flag: '🇨🇫', code: 'CF' },
  { name: 'Chad', flag: '🇹🇩', code: 'TD' },
  { name: 'Chile', flag: '🇨🇱', code: 'CL' },
  { name: 'China', flag: '🇨🇳', code: 'CN' },
  { name: 'Colombia', flag: '🇨🇴', code: 'CO' },
  { name: 'Comoros', flag: '🇰🇲', code: 'KM' },
  { name: 'Congo', flag: '🇨🇬', code: 'CG' },
  { name: 'Costa Rica', flag: '🇨🇷', code: 'CR' },
  { name: 'Croatia', flag: '🇭🇷', code: 'HR' },
  { name: 'Cuba', flag: '🇨🇺', code: 'CU' },
  { name: 'Cyprus', flag: '🇨🇾', code: 'CY' },
  { name: 'Czech Republic', flag: '🇨🇿', code: 'CZ' },
  { name: 'Denmark', flag: '🇩🇰', code: 'DK' },
  { name: 'Djibouti', flag: '🇩🇯', code: 'DJ' },
  { name: 'Dominican Republic', flag: '🇩🇴', code: 'DO' },
  { name: 'Ecuador', flag: '🇪🇨', code: 'EC' },
  { name: 'Egypt', flag: '🇪🇬', code: 'EG' },
  { name: 'El Salvador', flag: '🇸🇻', code: 'SV' },
  { name: 'Equatorial Guinea', flag: '🇬🇶', code: 'GQ' },
  { name: 'Eritrea', flag: '🇪🇷', code: 'ER' },
  { name: 'Estonia', flag: '🇪🇪', code: 'EE' },
  { name: 'Eswatini', flag: '🇸🇿', code: 'SZ' },
  { name: 'Ethiopia', flag: '🇪🇹', code: 'ET' },
  { name: 'Fiji', flag: '🇫🇯', code: 'FJ' },
  { name: 'Finland', flag: '🇫🇮', code: 'FI' },
  { name: 'France', flag: '🇫🇷', code: 'FR' },
  { name: 'Gabon', flag: '🇬🇦', code: 'GA' },
  { name: 'Gambia', flag: '🇬🇲', code: 'GM' },
  { name: 'Georgia', flag: '🇬🇪', code: 'GE' },
  { name: 'Germany', flag: '🇩🇪', code: 'DE' },
  { name: 'Ghana', flag: '🇬🇭', code: 'GH' },
  { name: 'Greece', flag: '🇬🇷', code: 'GR' },
  { name: 'Guatemala', flag: '🇬🇹', code: 'GT' },
  { name: 'Guinea', flag: '🇬🇳', code: 'GN' },
  { name: 'Guinea-Bissau', flag: '🇬🇼', code: 'GW' },
  { name: 'Guyana', flag: '🇬🇾', code: 'GY' },
  { name: 'Haiti', flag: '🇭🇹', code: 'HT' },
  { name: 'Honduras', flag: '🇭🇳', code: 'HN' },
  { name: 'Hungary', flag: '🇭🇺', code: 'HU' },
  { name: 'Iceland', flag: '🇮🇸', code: 'IS' },
  { name: 'India', flag: '🇮🇳', code: 'IN' },
  { name: 'Indonesia', flag: '🇮🇩', code: 'ID' },
  { name: 'Iran', flag: '🇮🇷', code: 'IR' },
  { name: 'Iraq', flag: '🇮🇶', code: 'IQ' },
  { name: 'Ireland', flag: '🇮🇪', code: 'IE' },
  { name: 'Israel', flag: '🇮🇱', code: 'IL' },
  { name: 'Italy', flag: '🇮🇹', code: 'IT' },
  { name: 'Jamaica', flag: '🇯🇲', code: 'JM' },
  { name: 'Japan', flag: '🇯🇵', code: 'JP' },
  { name: 'Jordan', flag: '🇯🇴', code: 'JO' },
  { name: 'Kazakhstan', flag: '🇰🇿', code: 'KZ' },
  { name: 'Kenya', flag: '🇰🇪', code: 'KE' },
  { name: 'Kuwait', flag: '🇰🇼', code: 'KW' },
  { name: 'Kyrgyzstan', flag: '🇰🇬', code: 'KG' },
  { name: 'Laos', flag: '🇱🇦', code: 'LA' },
  { name: 'Latvia', flag: '🇱🇻', code: 'LV' },
  { name: 'Lebanon', flag: '🇱🇧', code: 'LB' },
  { name: 'Lesotho', flag: '🇱🇸', code: 'LS' },
  { name: 'Liberia', flag: '🇱🇷', code: 'LR' },
  { name: 'Libya', flag: '🇱🇾', code: 'LY' },
  { name: 'Liechtenstein', flag: '🇱🇮', code: 'LI' },
  { name: 'Lithuania', flag: '🇱🇹', code: 'LT' },
  { name: 'Luxembourg', flag: '🇱🇺', code: 'LU' },
  { name: 'Madagascar', flag: '🇲🇬', code: 'MG' },
  { name: 'Malawi', flag: '🇲🇼', code: 'MW' },
  { name: 'Malaysia', flag: '🇲🇾', code: 'MY' },
  { name: 'Maldives', flag: '🇲🇻', code: 'MV' },
  { name: 'Mali', flag: '🇲🇱', code: 'ML' },
  { name: 'Malta', flag: '🇲🇹', code: 'MT' },
  { name: 'Mauritania', flag: '🇲🇷', code: 'MR' },
  { name: 'Mauritius', flag: '🇲🇺', code: 'MU' },
  { name: 'Mexico', flag: '🇲🇽', code: 'MX' },
  { name: 'Moldova', flag: '🇲🇩', code: 'MD' },
  { name: 'Monaco', flag: '🇲🇨', code: 'MC' },
  { name: 'Mongolia', flag: '🇲🇳', code: 'MN' },
  { name: 'Montenegro', flag: '🇲🇪', code: 'ME' },
  { name: 'Morocco', flag: '🇲🇦', code: 'MA' },
  { name: 'Mozambique', flag: '🇲🇿', code: 'MZ' },
  { name: 'Myanmar', flag: '🇲🇲', code: 'MM' },
  { name: 'Namibia', flag: '🇳🇦', code: 'NA' },
  { name: 'Nepal', flag: '🇳🇵', code: 'NP' },
  { name: 'Netherlands', flag: '🇳🇱', code: 'NL' },
  { name: 'New Zealand', flag: '🇳🇿', code: 'NZ' },
  { name: 'Nicaragua', flag: '🇳🇮', code: 'NI' },
  { name: 'Niger', flag: '🇳🇪', code: 'NE' },
  { name: 'Nigeria', flag: '🇳🇬', code: 'NG' },
  { name: 'North Korea', flag: '🇰🇵', code: 'KP' },
  { name: 'North Macedonia', flag: '🇲🇰', code: 'MK' },
  { name: 'Norway', flag: '🇳🇴', code: 'NO' },
  { name: 'Oman', flag: '🇴🇲', code: 'OM' },
  { name: 'Pakistan', flag: '🇵🇰', code: 'PK' },
  { name: 'Palestine', flag: '🇵🇸', code: 'PS' },
  { name: 'Panama', flag: '🇵🇦', code: 'PA' },
  { name: 'Papua New Guinea', flag: '🇵🇬', code: 'PG' },
  { name: 'Paraguay', flag: '🇵🇾', code: 'PY' },
  { name: 'Peru', flag: '🇵🇪', code: 'PE' },
  { name: 'Philippines', flag: '🇵🇭', code: 'PH' },
  { name: 'Poland', flag: '🇵🇱', code: 'PL' },
  { name: 'Portugal', flag: '🇵🇹', code: 'PT' },
  { name: 'Qatar', flag: '🇶🇦', code: 'QA' },
  { name: 'Romania', flag: '🇷🇴', code: 'RO' },
  { name: 'Russia', flag: '🇷🇺', code: 'RU' },
  { name: 'Rwanda', flag: '🇷🇼', code: 'RW' },
  { name: 'Saudi Arabia', flag: '🇸🇦', code: 'SA' },
  { name: 'Senegal', flag: '🇸🇳', code: 'SN' },
  { name: 'Serbia', flag: '🇷🇸', code: 'RS' },
  { name: 'Sierra Leone', flag: '🇸🇱', code: 'SL' },
  { name: 'Singapore', flag: '🇸🇬', code: 'SG' },
  { name: 'Slovakia', flag: '🇸🇰', code: 'SK' },
  { name: 'Slovenia', flag: '🇸🇮', code: 'SI' },
  { name: 'Somalia', flag: '🇸🇴', code: 'SO' },
  { name: 'South Africa', flag: '🇿🇦', code: 'ZA' },
  { name: 'South Korea', flag: '🇰🇷', code: 'KR' },
  { name: 'South Sudan', flag: '🇸🇸', code: 'SS' },
  { name: 'Spain', flag: '🇪🇸', code: 'ES' },
  { name: 'Sri Lanka', flag: '🇱🇰', code: 'LK' },
  { name: 'Sudan', flag: '🇸🇩', code: 'SD' },
  { name: 'Suriname', flag: '🇸🇷', code: 'SR' },
  { name: 'Sweden', flag: '🇸🇪', code: 'SE' },
  { name: 'Switzerland', flag: '🇨🇭', code: 'CH' },
  { name: 'Syria', flag: '🇸🇾', code: 'SY' },
  { name: 'Taiwan', flag: '🇹🇼', code: 'TW' },
  { name: 'Tajikistan', flag: '🇹🇯', code: 'TJ' },
  { name: 'Tanzania', flag: '🇹🇿', code: 'TZ' },
  { name: 'Thailand', flag: '🇹🇭', code: 'TH' },
  { name: 'Timor-Leste', flag: '🇹🇱', code: 'TL' },
  { name: 'Togo', flag: '🇹🇬', code: 'TG' },
  { name: 'Trinidad and Tobago', flag: '🇹🇹', code: 'TT' },
  { name: 'Tunisia', flag: '🇹🇳', code: 'TN' },
  { name: 'Turkey', flag: '🇹🇷', code: 'TR' },
  { name: 'Turkmenistan', flag: '🇹🇲', code: 'TM' },
  { name: 'Uganda', flag: '🇺🇬', code: 'UG' },
  { name: 'Ukraine', flag: '🇺🇦', code: 'UA' },
  { name: 'United Arab Emirates', flag: '🇦🇪', code: 'AE' },
  { name: 'United Kingdom', flag: '🇬🇧', code: 'GB' },
  { name: 'United States', flag: '🇺🇸', code: 'US' },
  { name: 'Uruguay', flag: '🇺🇾', code: 'UY' },
  { name: 'Uzbekistan', flag: '🇺🇿', code: 'UZ' },
  { name: 'Venezuela', flag: '🇻🇪', code: 'VE' },
  { name: 'Vietnam', flag: '🇻🇳', code: 'VN' },
  { name: 'Yemen', flag: '🇾🇪', code: 'YE' },
  { name: 'Zambia', flag: '🇿🇲', code: 'ZM' },
  { name: 'Zimbabwe', flag: '🇿🇼', code: 'ZW' },
];

interface CountrySelectProps {
  value: string;
  onChange: (value: string) => void;
}

const CountrySelect: React.FC<CountrySelectProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const selected = COUNTRIES.find(
    c => c.name.toLowerCase() === value.toLowerCase()
  ) || null;

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

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (country: Country) => {
    onChange(country.name);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className={styles.wrapper} ref={ref}>
      <div className={styles.control} onClick={() => setOpen(o => !o)}>
        {selected ? (
          <span className={styles.selected}>
            <span className={styles.flag}>{selected.flag}</span>
            {selected.name}
          </span>
        ) : (
          <span className={styles.placeholder}>Select country…</span>
        )}
        <span className={styles.arrow}>{open ? '▲' : '▼'}</span>
      </div>

      {open && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrap}>
            <input
              autoFocus
              className={styles.search}
              placeholder="Search country…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <ul className={styles.list}>
            {filtered.length === 0 && (
              <li className={styles.empty}>No countries found</li>
            )}
            {filtered.map(country => (
              <li
                key={country.code}
                className={`${styles.item} ${selected?.code === country.code ? styles.active : ''}`}
                onClick={() => handleSelect(country)}
              >
                <span className={styles.flag}>{country.flag}</span>
                {country.name}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default CountrySelect;

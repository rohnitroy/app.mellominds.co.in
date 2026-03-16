import React, { useState, useRef, useEffect } from 'react';
import styles from './CustomDropdown.module.css';

interface DropdownOption {
  value: string;
  label: string;
}

interface CustomDropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  className = '',
  disabled = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(opt => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setIsOpen(false);
  };

  return (
    <div 
      className={`${styles.customDropdown} ${className} ${disabled ? styles.disabled : ''}`} 
      ref={dropdownRef}
    >
      <div 
        className={`${styles.dropdownHeader} ${isOpen ? styles.open : ''}`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={styles.selectedValue}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className={`${styles.arrow} ${isOpen ? styles.arrowUp : ''}`}>▼</span>
      </div>
      
      {isOpen && (
        <div className={styles.dropdownList}>
          {options.map((option) => (
            <div
              key={option.value}
              className={`${styles.dropdownItem} ${value === option.value ? styles.selected : ''}`}
              onClick={() => handleSelect(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown;

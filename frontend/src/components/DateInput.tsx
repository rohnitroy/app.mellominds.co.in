import React from 'react';

interface DateInputProps {
    value: string; // YYYY-MM-DD format
    onChange: (value: string) => void;
    min?: string;
    max?: string;
    className?: string;
    style?: React.CSSProperties;
    placeholder?: string;
}

const DateInput: React.FC<DateInputProps> = ({ value, onChange, min, max, className, style }) => {
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        onChange(e.target.value); // native date input already gives YYYY-MM-DD
    };

    return (
        <input
            type="date"
            className={className}
            style={style}
            value={value}
            onChange={handleChange}
            min={min}
            max={max}
        />
    );
};

export default DateInput;

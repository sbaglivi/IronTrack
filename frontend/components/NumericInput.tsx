import React, { useState, useRef, useEffect } from 'react';

interface NumericInputProps {
  value: number;
  onChange: (value: number) => void;
  allowDecimal?: boolean;
  className?: string;
}

function numberToDisplay(n: number): string {
  return n === 0 ? '' : String(n);
}

const NumericInput: React.FC<NumericInputProps> = ({
  value,
  onChange,
  allowDecimal = false,
  className,
}) => {
  const [displayValue, setDisplayValue] = useState(() => numberToDisplay(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const isFocusedRef = useRef(false);

  useEffect(() => {
    if (!isFocusedRef.current) {
      setDisplayValue(numberToDisplay(value));
    }
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const pattern = allowDecimal ? /^[0-9]*\.?[0-9]*$/ : /^[0-9]*$/;
    if (!pattern.test(raw)) return;
    setDisplayValue(raw);
    onChange(parseFloat(raw) || 0);
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
    setTimeout(() => inputRef.current?.select(), 0);
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    const parsed = parseFloat(displayValue) || 0;
    setDisplayValue(numberToDisplay(parsed));
    onChange(parsed);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode={allowDecimal ? 'decimal' : 'numeric'}
      autoComplete="off"
      value={displayValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      className={className}
    />
  );
};

export default NumericInput;

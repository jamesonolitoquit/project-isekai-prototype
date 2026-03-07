import React, { useRef, useEffect } from 'react';

interface StatAdjusterProps {
  value: number;
  min?: number;
  max?: number;
  onChange: (newValue: number) => void;
  icon?: string;
  label: string;
  disabled?: boolean;
}

export function StatAdjuster({
  value,
  min = 1,
  max = 20,
  onChange,
  icon,
  label,
  disabled = false,
}: StatAdjusterProps) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const valueRef = useRef(value);

  // Keep ref in sync so the interval closure always sees the latest value
  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const startHold = (direction: 1 | -1) => {
    if (disabled) return;

    // Immediate single increment
    onChange(clamp(valueRef.current + direction));

    // After 250ms hold, rapid-fire at 80ms
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onChange(clamp(valueRef.current + direction));
      }, 80);
    }, 250);
  };

  const stopHold = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  return (
    <div className={`stat-adjuster${disabled ? ' disabled' : ''}`}>
      <div className="stat-label">
        {icon && <span className="stat-icon">{icon}</span>}
        <span>{label}</span>
      </div>
      <div className="stat-controls">
        <button
          className="stat-btn stat-btn-decrease"
          onMouseDown={() => startHold(-1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(-1)}
          onTouchEnd={stopHold}
          disabled={value <= min || disabled}
          aria-label={`Decrease ${label}`}
          type="button"
        >
          −
        </button>
        <input
          type="number"
          value={value}
          onChange={(e) => {
            const parsed = parseInt(e.target.value, 10);
            if (!isNaN(parsed)) onChange(clamp(parsed));
          }}
          min={min}
          max={max}
          className="stat-input"
          disabled={disabled}
          aria-label={label}
        />
        <button
          className="stat-btn stat-btn-increase"
          onMouseDown={() => startHold(1)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(1)}
          onTouchEnd={stopHold}
          disabled={value >= max || disabled}
          aria-label={`Increase ${label}`}
          type="button"
        >
          +
        </button>
      </div>
    </div>
  );
}

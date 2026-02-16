import React from 'react';

interface WeatherPanelProps {
  state?: any;
}

export default function WeatherPanel({ state }: WeatherPanelProps) {
  const weather = state?.weather ?? 'clear';

  return (
    <div className="weather-panel">
      <h3>Weather</h3>
      <p>Current: {weather}</p>
    </div>
  );
}

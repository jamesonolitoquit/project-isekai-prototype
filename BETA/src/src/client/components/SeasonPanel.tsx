import React from 'react';

interface SeasonPanelProps {
  state?: any;
}

export default function SeasonPanel({ state }: SeasonPanelProps) {
  const season = state?.season ?? 'winter';
  const day = state?.day ?? 1;
  const hour = state?.hour ?? 8;
  const dayPhase = state?.dayPhase ?? 'morning';

  return (
    <div className="season-panel">
      <h3>Season & Time</h3>
      <p>Season: {season}</p>
      <p>Day: {day}</p>
      <p>Hour: {hour}</p>
      <p>Phase: {dayPhase}</p>
    </div>
  );
}

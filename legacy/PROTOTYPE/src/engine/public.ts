// Re-exports for public API
// export { createWorldController, createInitialWorld } from './worldEngine';
export { createInitialWorld } from './worldEngine';
export type { Event } from '../events/mutationLog';
export { appendEvent, getEventsForWorld } from '../events/mutationLog';
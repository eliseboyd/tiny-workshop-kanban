// A location is where Elise physically is — Home, Studio. Merlin owns them
// (public.locations, merlin migration 0040); the board reads them and tells
// Merlin when the dashboard switcher changes.
export type MerlinLocation = {
  key: string;
  label: string;
  emoji: string | null;
  position: number;
};

export type LocationState = {
  locations: MerlinLocation[];
  currentKey: string | null;
};

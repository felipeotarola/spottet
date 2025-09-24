// Global type declarations for Google Maps
declare global {
  interface Window {
    navigateToFountain: (lat: number, lng: number) => void;
    navigateToPlace: (placeId: string) => void;
    shareFountain: (name: string, address: string) => void;
    sharePlace: (name: string, vicinity: string) => void;
    toggleFountainFavorite: (fountainId: string) => void;
  }
}

export {};
import { Loader } from "@googlemaps/js-api-loader";

class GoogleMapsLoader {
  private static instance: GoogleMapsLoader;
  private loader: Loader | null = null;
  private isLoaded = false;
  private loadPromise: Promise<void> | null = null;

  private constructor() {}

  static getInstance(): GoogleMapsLoader {
    if (!GoogleMapsLoader.instance) {
      GoogleMapsLoader.instance = new GoogleMapsLoader();
    }
    return GoogleMapsLoader.instance;
  }

  async load(): Promise<void> {
    if (this.isLoaded) {
      return;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = this.initializeLoader();
    return this.loadPromise;
  }

  private async initializeLoader(): Promise<void> {
    if (!this.loader) {
      this.loader = new Loader({
        apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
        version: "weekly",
        libraries: ["places", "geometry"]
      });
    }

    await this.loader.load();
    this.isLoaded = true;
  }

  isGoogleMapsLoaded(): boolean {
    return this.isLoaded && typeof google !== 'undefined';
  }
}

export const googleMapsLoader = GoogleMapsLoader.getInstance();
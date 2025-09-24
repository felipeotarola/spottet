import { googleMapsLoader } from "./google-maps-loader";

export interface PlaceResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number;
  isOpen: boolean;
  placeId: string;
  photos?: string[];
}

export class GooglePlacesService {
  private PlaceClass: typeof google.maps.places.Place | null = null;
  private isLoaded = false;

  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    await googleMapsLoader.load();
    
    // Import the new Places library
    const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
    this.PlaceClass = Place;
    this.isLoaded = true;
  }

  async searchNearbyFountains(
    location: google.maps.LatLngLiteral,
    radius: number = 5000
  ): Promise<PlaceResult[]> {
    if (!this.PlaceClass) {
      await this.initialize();
    }

    if (!this.PlaceClass) {
      throw new Error("Places service not initialized");
    }

    try {
      const request: google.maps.places.SearchNearbyRequest = {
        fields: ["id", "displayName", "formattedAddress", "location", "rating", "regularOpeningHours", "photos"],
        locationRestriction: {
          center: location,
          radius: radius,
        },
        // Search for water fountains using text-based search with nearby location constraint
        includedPrimaryTypes: ["tourist_attraction", "park"], // Include common places where fountains might be found
        maxResultCount: 20,
        rankPreference: google.maps.places.SearchNearbyRankPreference.DISTANCE,
        language: "sv",
        region: "se",
      };

      const { places } = await this.PlaceClass.searchNearby(request);

      // Filter and map results to match our interface
      const fountainPlaces: PlaceResult[] = places
        .filter(place => place.location && place.id)
        .map(place => ({
          id: place.id!,
          name: place.displayName || "Dricksvattenfontän",
          address: place.formattedAddress || "Okänd adress",
          lat: place.location!.lat(),
          lng: place.location!.lng(),
          rating: place.rating || 0,
          isOpen: true, // For now, assume open - we'll enhance this later
          placeId: place.id!,
          photos: place.photos?.map(photo => 
            photo.getURI({ maxWidth: 400, maxHeight: 300 })
          ) || []
        }));

      return fountainPlaces;
    } catch (error) {
      throw new Error(`Places search failed: ${error}`);
    }
  }

  async searchFountainsByText(query: string, location?: google.maps.LatLngLiteral): Promise<PlaceResult[]> {
    if (!this.PlaceClass) {
      await this.initialize();
    }

    if (!this.PlaceClass) {
      throw new Error("Places service not initialized");
    }

    try {
      const request: google.maps.places.SearchByTextRequest = {
        fields: ["id", "displayName", "formattedAddress", "location", "rating", "regularOpeningHours", "photos"],
        textQuery: `${query} water fountain drinking fountain dricksvatten vattenpost`,
        locationBias: location ? { center: location, radius: 10000 } : undefined,
        maxResultCount: 20,
        language: "sv",
        region: "se",
      };

      const { places } = await this.PlaceClass.searchByText(request);

      const fountainPlaces: PlaceResult[] = places
        .filter(place => place.location && place.id)
        .map(place => ({
          id: place.id!,
          name: place.displayName || "Dricksvattenfontän",
          address: place.formattedAddress || "Okänd adress",
          lat: place.location!.lat(),
          lng: place.location!.lng(),
          rating: place.rating || 0,
          isOpen: true, // For now, assume open - we'll enhance this later
          placeId: place.id!,
          photos: place.photos?.map(photo => 
            photo.getURI({ maxWidth: 400, maxHeight: 300 })
          ) || []
        }));

      return fountainPlaces;
    } catch (error) {
      throw new Error(`Text search failed: ${error}`);
    }
  }

  async getPlaceDetails(placeId: string): Promise<google.maps.places.Place | null> {
    if (!this.PlaceClass) {
      await this.initialize();
    }

    if (!this.PlaceClass) {
      throw new Error("Places service not initialized");
    }

    try {
      const place = new this.PlaceClass({ id: placeId });
      
      const fields = [
        'displayName', 
        'formattedAddress', 
        'location', 
        'rating', 
        'regularOpeningHours', 
        'photos', 
        'websiteURI',
        'nationalPhoneNumber',
        'reviews'
      ];

      await place.fetchFields({ fields });
      return place;
    } catch (error) {
      throw new Error(`Place details failed: ${error}`);
    }
  }
}

export const googlePlacesService = new GooglePlacesService();
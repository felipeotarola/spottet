import { Loader } from "@googlemaps/js-api-loader";

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
  private placesService: google.maps.places.PlacesService | null = null;
  private isLoaded = false;

  async initialize(): Promise<void> {
    if (this.isLoaded) return;

    const loader = new Loader({
      apiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!,
      version: "weekly",
      libraries: ["places"]
    });

    await loader.load();
    
    // Create a dummy map element for PlacesService (required by Google)
    const dummyMap = new google.maps.Map(document.createElement('div'));
    this.placesService = new google.maps.places.PlacesService(dummyMap);
    this.isLoaded = true;
  }

  async searchNearbyFountains(
    location: google.maps.LatLngLiteral,
    radius: number = 5000
  ): Promise<PlaceResult[]> {
    if (!this.placesService) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error("Places service not initialized"));
        return;
      }

      const request: google.maps.places.PlaceSearchRequest = {
        location,
        radius,
        keyword: "water fountain drinking fountain vattenpost dricksvatten water tap",
        type: "point_of_interest"
      };

      this.placesService.nearbySearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: PlaceResult[] = results
            .filter(place => place.geometry?.location && place.place_id)
            .map(place => ({
              id: place.place_id!,
              name: place.name || "Dricksvattenfontän",
              address: place.vicinity || "Okänd adress",
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng(),
              rating: place.rating || 0,
              isOpen: place.opening_hours?.open_now ?? true,
              placeId: place.place_id!,
              photos: place.photos?.map(photo => 
                photo.getUrl({ maxWidth: 400, maxHeight: 300 })
              )
            }));

          resolve(places);
        } else {
          reject(new Error(`Places search failed: ${status}`));
        }
      });
    });
  }

  async searchFountainsByText(query: string, location?: google.maps.LatLngLiteral): Promise<PlaceResult[]> {
    if (!this.placesService) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error("Places service not initialized"));
        return;
      }

      const request: google.maps.places.TextSearchRequest = {
        query: `${query} water fountain drinking fountain dricksvatten`,
        location,
        radius: location ? 10000 : undefined
      };

      this.placesService.textSearch(request, (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          const places: PlaceResult[] = results
            .filter(place => place.geometry?.location && place.place_id)
            .map(place => ({
              id: place.place_id!,
              name: place.name || "Dricksvattenfontän",
              address: place.formatted_address || place.vicinity || "Okänd adress",
              lat: place.geometry!.location!.lat(),
              lng: place.geometry!.location!.lng(),
              rating: place.rating || 0,
              isOpen: place.opening_hours?.open_now ?? true,
              placeId: place.place_id!,
              photos: place.photos?.map(photo => 
                photo.getUrl({ maxWidth: 400, maxHeight: 300 })
              )
            }));

          resolve(places);
        } else {
          reject(new Error(`Text search failed: ${status}`));
        }
      });
    });
  }

  async getPlaceDetails(placeId: string): Promise<google.maps.places.PlaceResult | null> {
    if (!this.placesService) {
      await this.initialize();
    }

    return new Promise((resolve, reject) => {
      if (!this.placesService) {
        reject(new Error("Places service not initialized"));
        return;
      }

      const request: google.maps.places.PlaceDetailsRequest = {
        placeId,
        fields: [
          'name', 
          'formatted_address', 
          'geometry', 
          'rating', 
          'opening_hours', 
          'photos', 
          'website',
          'formatted_phone_number',
          'reviews'
        ]
      };

      this.placesService.getDetails(request, (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          resolve(place);
        } else {
          reject(new Error(`Place details failed: ${status}`));
        }
      });
    });
  }
}

export const googlePlacesService = new GooglePlacesService();
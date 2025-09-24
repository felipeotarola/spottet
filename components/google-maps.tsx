"use client";

import { useEffect, useRef, useState } from "react";
import { googleMapsLoader } from "@/lib/google-maps-loader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Navigation, Heart, Camera, Star, Clock } from "lucide-react";

interface Fountain {
  id: string;
  name: string;
  address: string;
  distance: number;
  hours: string;
  isFavorite: boolean;
  isWorking: boolean;
  rating: number;
  hasPhoto: boolean;
  lat: number;
  lng: number;
  placeId?: string;
}

interface GoogleMapsProps {
  fountains: Fountain[];
  onFountainSelect: (fountain: Fountain) => void;
  selectedFountain: Fountain | null;
  onToggleFavorite: (fountainId: string) => void;
}

export default function GoogleMapsComponent({ 
  fountains, 
  onFountainSelect, 
  selectedFountain,
  onToggleFavorite 
}: GoogleMapsProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [searchStatus, setSearchStatus] = useState<string>("Initierar karta...");

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      try {
        await googleMapsLoader.load();
        
        // Wait for the map ref to be available
        let attempts = 0;
        while (!mapRef.current && attempts < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          attempts++;
        }
        
        if (mapRef.current) {
          // Default to Stockholm center
          const defaultCenter = { lat: 59.3293, lng: 18.0686 };
          
          const map = new google.maps.Map(mapRef.current, {
            center: defaultCenter,
            zoom: 13,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: true,
            zoomControl: true,
            gestureHandling: "greedy"
          });

          mapInstanceRef.current = map;

          // Initialize InfoWindow
          infoWindowRef.current = new google.maps.InfoWindow();

          // Get user location with proper error handling
          if (navigator.geolocation) {
            setSearchStatus("Begär din position...");
            
            navigator.geolocation.getCurrentPosition(
              async (position) => {
                const userPos = {
                  lat: position.coords.latitude,
                  lng: position.coords.longitude
                };
                setUserLocation(userPos);
                map.setCenter(userPos);
                
                // Add user location marker with pulsing effect
                const userMarker = new google.maps.Marker({
                  position: userPos,
                  map: map,
                  title: "Din position",
                  icon: {
                    url: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='14' fill='%234285F4' fill-opacity='0.3'/%3E%3Ccircle cx='16' cy='16' r='8' fill='%234285F4'/%3E%3Ccircle cx='16' cy='16' r='4' fill='white'/%3E%3C/svg%3E",
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16)
                  },
                  zIndex: 1000
                });
                
                // Add accuracy circle around user position
                new google.maps.Circle({
                  strokeColor: '#4285F4',
                  strokeOpacity: 0.3,
                  strokeWeight: 1,
                  fillColor: '#4285F4',
                  fillOpacity: 0.1,
                  map: map,
                  center: userPos,
                  radius: position.coords.accuracy || 100
                });

                await searchNearbyFountains(userPos, map);
                setIsLoading(false);
              },
              async (error) => {
                let errorMessage = "Kunde inte hämta din position";
                
                switch(error.code) {
                  case error.PERMISSION_DENIED:
                    errorMessage = "Position nekad - använder Stockholm som standard";
                    break;
                  case error.POSITION_UNAVAILABLE:
                    errorMessage = "Position otillgänglig - använder Stockholm som standard";
                    break;
                  case error.TIMEOUT:
                    errorMessage = "Position timeout - använder Stockholm som standard";
                    break;
                }
                
                setSearchStatus(errorMessage);
                await searchNearbyFountains(defaultCenter, map);
                setIsLoading(false);
                
                // Clear error message after 3 seconds
                setTimeout(() => setSearchStatus(""), 3000);
              },
              {
                enableHighAccuracy: true,
                timeout: 10000, // 10 seconds timeout
                maximumAge: 300000 // 5 minutes cache
              }
            );
          } else {
            setSearchStatus("Geolocation stöds inte - använder Stockholm");
            await searchNearbyFountains(defaultCenter, map);
            setIsLoading(false);
            
            // Clear message after 3 seconds
            setTimeout(() => setSearchStatus(""), 3000);
          }
        } else {
          console.error("Map ref is null");
          setIsLoading(false);
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
        setIsLoading(false);
      }
    };

    initMap();
  }, []);

  // Search for nearby water fountains using new Places API
  const searchNearbyFountains = async (center: google.maps.LatLngLiteral, map: google.maps.Map) => {
    let foundPlacesCount = 0;
    
    try {
      setSearchStatus("Importerar Places-bibliotek...");
      
      // Import the new Places library
      const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
      
      setSearchStatus("Söker efter vattenfontäner...");
      
      // Search for water fountains using text search (more effective for specific items like fountains)
      const textRequest: google.maps.places.SearchByTextRequest = {
        fields: ["id", "displayName", "formattedAddress", "location", "rating", "photos"],
        textQuery: "water fountain drinking fountain vattenpost dricksvatten drinking water source",
        locationBias: { center: center, radius: 5000 },
        maxResultCount: 20,
        language: "sv",
        region: "se",
      };

      const { places } = await Place.searchByText(textRequest);
      
      if (places && places.length > 0) {
        places.forEach((place, index) => {
          if (place.location) {
            addFountainMarker(place, map, index);
            foundPlacesCount++;
          }
        });
      }

      setSearchStatus("Söker efter parker och turistattraktioner...");
      
      // Also search nearby for parks and tourist attractions where fountains might be located
      const nearbyRequest: google.maps.places.SearchNearbyRequest = {
        fields: ["id", "displayName", "formattedAddress", "location", "rating", "photos"],
        locationRestriction: {
          center: center,
          radius: 2000, // Smaller radius for more targeted results
        },
        includedPrimaryTypes: ["park", "tourist_attraction"],
        maxResultCount: 10,
        rankPreference: google.maps.places.SearchNearbyRankPreference.DISTANCE,
        language: "sv",
        region: "se",
      };

      const { places: nearbyPlaces } = await Place.searchNearby(nearbyRequest);
      
      if (nearbyPlaces && nearbyPlaces.length > 0) {
        // Filter for places that might have water fountains
        const filteredPlaces = nearbyPlaces.filter(place => {
          const name = place.displayName?.toLowerCase() || '';
          return name.includes('park') || name.includes('fountain') || name.includes('vatten');
        });
        
        filteredPlaces.forEach((place, index) => {
          if (place.location) {
            addFountainMarker(place, map, index + 100); // Offset index to avoid conflicts
            foundPlacesCount++;
          }
        });
      }

      const statusMessage = foundPlacesCount > 0 
        ? `Hittade ${foundPlacesCount} potentiella fontäner` 
        : "Inga fontäner hittades i närområdet";
      
      setSearchStatus(statusMessage);
      
      // Hide status after 3 seconds
      setTimeout(() => setSearchStatus(""), 3000);
      
    } catch (error) {
      console.error("Error searching for fountains:", error);
      setSearchStatus("Fel vid sökning efter fontäner. Kontrollera att Places API (New) är aktiverat.");
      setIsLoading(false); // Make sure to set loading to false even on error
      
      // Hide error after 5 seconds
      setTimeout(() => setSearchStatus(""), 5000);
    }
  };

  // Add fountain markers to map
  const addFountainMarker = (place: google.maps.places.Place, map: google.maps.Map, index: number) => {
    if (!place.location) return;

    const marker = new google.maps.Marker({
      position: place.location,
      map: map,
      title: place.displayName || "Water Fountain",
      icon: {
        url: "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='%232563EB'/%3E%3Ccircle cx='12' cy='9' r='2.5' fill='white'/%3E%3C/svg%3E",
        scaledSize: new google.maps.Size(40, 40),
        anchor: new google.maps.Point(20, 40)
      },
      animation: google.maps.Animation.DROP
    });

    // Add click listener for marker
    marker.addListener("click", () => {
      if (infoWindowRef.current && place.location) {
        const distance = userLocation ? 
          google.maps.geometry.spherical.computeDistanceBetween(
            new google.maps.LatLng(userLocation.lat, userLocation.lng),
            place.location
          ) / 1000 : 0;

        const content = createNewInfoWindowContent(place, distance);
        infoWindowRef.current.setContent(content);
        infoWindowRef.current.open(map, marker);
      }
    });

    markersRef.current.push(marker);
  };

  // Create info window content for legacy places
  const createInfoWindowContent = (place: google.maps.places.PlaceResult, distance: number) => {
    const rating = place.rating || 0;
    const isOpen = place.opening_hours?.open_now ?? true;
    
    return `
      <div style="max-width: 300px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">
          ${place.name || 'Dricksvattenfontän'}
        </h3>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
          ${place.vicinity || 'Okänd adress'}
        </p>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 12px; color: #6b7280;">
          <span>📍 ${distance.toFixed(1)} km</span>
          <span>⭐ ${rating.toFixed(1)}</span>
          <span style="color: ${isOpen ? '#059669' : '#dc2626'};">
            ${isOpen ? '🟢 Öppen' : '🔴 Stängd'}
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="navigateToPlace('${place.place_id}')" 
                  style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            🧭 Navigera
          </button>
          <button onclick="sharePlace('${place.name}', '${place.vicinity}')" 
                  style="background: #6b7280; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            🔗 Dela
          </button>
        </div>
      </div>
    `;
  };

  // Create info window content for new Place class
  const createNewInfoWindowContent = (place: google.maps.places.Place, distance: number) => {
    const rating = place.rating || 0;
    const isOpen = true; // For now, assume open - we'll enhance this later
    
    return `
      <div style="max-width: 300px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; font-weight: 600; color: #1f2937;">
          ${place.displayName || 'Dricksvattenfontän'}
        </h3>
        <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
          ${place.formattedAddress || 'Okänd adress'}
        </p>
        <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 12px; font-size: 12px; color: #6b7280;">
          <span>📍 ${distance.toFixed(1)} km</span>
          <span>⭐ ${rating.toFixed(1)}</span>
          <span style="color: ${isOpen ? '#059669' : '#dc2626'};">
            ${isOpen ? '🟢 Potentiell fontän' : '🔴 Stängd'}
          </span>
        </div>
        <div style="display: flex; gap: 8px;">
          <button onclick="navigateToPlace('${place.id}')" 
                  style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            🧭 Navigera
          </button>
          <button onclick="sharePlace('${place.displayName}', '${place.formattedAddress}')" 
                  style="background: #6b7280; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer;">
            🔗 Dela
          </button>
        </div>
      </div>
    `;
  };

  // Update markers when fountains change
  useEffect(() => {
    if (!mapInstanceRef.current) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.setMap(null));
    markersRef.current = [];

    // Add markers for fountains
    fountains.forEach((fountain) => {
      const marker = new google.maps.Marker({
        position: { lat: fountain.lat, lng: fountain.lng },
        map: mapInstanceRef.current!,
        title: fountain.name,
        icon: {
          url: fountain.isWorking 
            ? "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='%232563EB'/%3E%3Ccircle cx='12' cy='9' r='2.5' fill='white'/%3E%3C/svg%3E"
            : "data:image/svg+xml;charset=UTF-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='36' height='36' viewBox='0 0 24 24'%3E%3Cpath d='M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z' fill='%23DC2626'/%3E%3Cpath d='M9.5 6.5L14.5 11.5M14.5 6.5L9.5 11.5' stroke='white' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E",
          scaledSize: new google.maps.Size(36, 36),
          anchor: new google.maps.Point(18, 36)
        },
        animation: fountain.isFavorite ? google.maps.Animation.BOUNCE : google.maps.Animation.DROP
      });

      marker.addListener("click", () => {
        onFountainSelect(fountain);
        
        if (infoWindowRef.current) {
          const content = `
            <div style="max-width: 300px; padding: 12px;">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;">
                <h3 style="margin: 0; font-weight: 600; color: #1f2937; flex: 1;">
                  ${fountain.name}
                </h3>
                <button onclick="toggleFountainFavorite('${fountain.id}')" 
                        style="background: none; border: none; cursor: pointer; padding: 4px; margin-left: 8px;">
                  ${fountain.isFavorite ? '❤️' : '🤍'}
                </button>
              </div>
              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280;">
                ${fountain.address}
              </p>
              <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px; font-size: 12px;">
                <span style="color: #6b7280;">📍 ${fountain.distance} km</span>
                <span style="color: #6b7280;">🕒 ${fountain.hours}</span>
                <span style="color: #6b7280;">⭐ ${fountain.rating}</span>
              </div>
              <div style="margin-bottom: 12px;">
                <span style="background: ${fountain.isWorking ? '#dcfce7' : '#fee2e2'}; 
                           color: ${fountain.isWorking ? '#166534' : '#dc2626'}; 
                           padding: 2px 8px; border-radius: 12px; font-size: 12px;">
                  ${fountain.isWorking ? '✅ Funkar' : '❌ Ur funktion'}
                </span>
                ${fountain.hasPhoto ? '<span style="margin-left: 8px;">📷</span>' : ''}
              </div>
              <div style="display: flex; gap: 8px;">
                <button onclick="navigateToFountain(${fountain.lat}, ${fountain.lng})" 
                        style="background: #2563eb; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; flex: 1;">
                  🧭 Navigera
                </button>
                <button onclick="shareFountain('${fountain.name}', '${fountain.address}')" 
                        style="background: #6b7280; color: white; border: none; padding: 8px 12px; border-radius: 6px; font-size: 12px; cursor: pointer; flex: 1;">
                  🔗 Dela
                </button>
              </div>
            </div>
          `;
          infoWindowRef.current.setContent(content);
          infoWindowRef.current.open(mapInstanceRef.current!, marker);
        }
      });

      markersRef.current.push(marker);
    });
  }, [fountains, onFountainSelect]);

  // Focus on selected fountain
  useEffect(() => {
    if (selectedFountain && mapInstanceRef.current) {
      mapInstanceRef.current.panTo({ lat: selectedFountain.lat, lng: selectedFountain.lng });
      mapInstanceRef.current.setZoom(16);
    }
  }, [selectedFountain]);

  // Global functions for InfoWindow buttons
  useEffect(() => {
    (window as any).navigateToFountain = (lat: number, lng: number) => {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
      window.open(url, '_blank');
    };

    (window as any).navigateToPlace = (placeId: string) => {
      const url = `https://www.google.com/maps/place/?q=place_id:${placeId}`;
      window.open(url, '_blank');
    };

    (window as any).shareFountain = (name: string, address: string) => {
      if (navigator.share) {
        navigator.share({
          title: `Dricksvattenfontän: ${name}`,
          text: `Hittade denna fontän på ${address}`,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(`${name} - ${address} | ${window.location.href}`);
        alert('Länk kopierad till urklipp!');
      }
    };

    (window as any).sharePlace = (name: string, vicinity: string) => {
      if (navigator.share) {
        navigator.share({
          title: `Dricksvattenfontän: ${name}`,
          text: `Hittade denna fontän nära ${vicinity}`,
          url: window.location.href
        });
      } else {
        navigator.clipboard.writeText(`${name} - ${vicinity} | ${window.location.href}`);
        alert('Länk kopierad till urklipp!');
      }
    };

    (window as any).toggleFountainFavorite = (fountainId: string) => {
      onToggleFavorite(fountainId);
    };
  }, [onToggleFavorite]);

  return (
    <div className="relative h-full">
      <div ref={mapRef} className="h-full w-full" />
      
      {/* Loading Overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center z-50">
          <Card className="w-80 shadow-xl">
            <CardContent className="p-8 text-center">
              <div className="relative mb-6">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto"></div>
                <MapPin className="w-6 h-6 text-blue-600 absolute top-3 left-1/2 transform -translate-x-1/2" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Laddar Spottet</h3>
              <p className="text-sm text-gray-600">Hämtar kartan och närliggande fontäner...</p>
              <div className="mt-4 flex justify-center space-x-2">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Map Controls */}
      <div className="absolute top-4 right-4 space-y-2">
        <Button 
          size="sm" 
          variant="secondary"
          className="shadow-lg bg-white hover:bg-gray-50"
          onClick={() => {
            if (userLocation && mapInstanceRef.current) {
              mapInstanceRef.current.panTo(userLocation);
              mapInstanceRef.current.setZoom(16);
            }
          }}
          disabled={!userLocation}
        >
          <Navigation className="w-4 h-4 mr-1" />
          Min position
        </Button>
        
        <Button 
          size="sm" 
          variant="secondary"
          className="shadow-lg bg-white hover:bg-gray-50"
          onClick={() => {
            if (mapInstanceRef.current && userLocation) {
              // Zoom out to show all fountains
              const bounds = new google.maps.LatLngBounds();
              bounds.extend(userLocation);
              
              fountains.forEach(fountain => {
                bounds.extend({ lat: fountain.lat, lng: fountain.lng });
              });
              
              mapInstanceRef.current.fitBounds(bounds, 50);
            }
          }}
        >
          <MapPin className="w-4 h-4 mr-1" />
          Visa alla
        </Button>
      </div>

      {/* Search Status */}
      {searchStatus && (
        <div className="absolute top-20 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-lg p-3 max-w-xs">
          <div className="flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
            <span className="text-sm text-gray-700">{searchStatus}</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2 max-w-xs">
        <h4 className="text-sm font-semibold text-gray-800 flex items-center">
          <MapPin className="w-4 h-4 mr-1 text-blue-600" />
          Förklaring
        </h4>
        <div className="flex items-center space-x-2 text-xs">
          <div className="w-3 h-3 bg-blue-600 rounded-full"></div>
          <span className="text-gray-600">Potentiell fontän</span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <div className="w-3 h-3 bg-red-600 rounded-full"></div>
          <span className="text-gray-600">Ur funktion</span>
        </div>
        <div className="flex items-center space-x-2 text-xs">
          <div className="w-3 h-3 bg-blue-400 rounded-full border-2 border-white shadow-sm"></div>
          <span className="text-gray-600">Din position</span>
        </div>
        {userLocation && (
          <div className="pt-2 border-t text-xs text-green-600">
            ✓ Position hittad
          </div>
        )}
        <div className="pt-2 border-t text-xs text-blue-600">
          ✨ Använder nya Places API
        </div>
      </div>
    </div>
  );
}
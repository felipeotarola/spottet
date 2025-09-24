"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import GoogleMapsComponent from "@/components/google-maps";
import { googlePlacesService, PlaceResult } from "@/lib/google-places";
import { 
  MapPin, 
  List, 
  Navigation, 
  Heart, 
  Search, 
  Filter, 
  Plus, 
  Star,
  Clock,
  Camera,
  Share,
  MoreVertical,
  Loader2
} from "lucide-react";

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
}

const mockFountains: Fountain[] = [
  {
    id: "1",
    name: "Sergels Torg Fontän",
    address: "Sergels Torg, 111 57 Stockholm",
    distance: 0.2,
    hours: "24/7",
    isFavorite: true,
    isWorking: true,
    rating: 4.5,
    hasPhoto: true,
    lat: 59.3326,
    lng: 18.0649
  },
  {
    id: "2", 
    name: "Kungsträdgården Fontän",
    address: "Kungsträdgården, 111 47 Stockholm",
    distance: 0.4,
    hours: "06:00 - 22:00",
    isFavorite: false,
    isWorking: true,
    rating: 4.2,
    hasPhoto: false,
    lat: 59.3312,
    lng: 18.0711
  },
  {
    id: "3",
    name: "Gamla Stan Fontän",
    address: "Stortorget 7, 111 29 Stockholm",
    distance: 0.6,
    hours: "24/7",
    isFavorite: false,
    isWorking: false,
    rating: 3.8,
    hasPhoto: true,
    lat: 59.3255,
    lng: 18.0711
  }
];

export default function SpottetApp() {
  const [activeTab, setActiveTab] = useState("map");
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [fountains, setFountains] = useState(mockFountains);
  const [selectedFountain, setSelectedFountain] = useState<Fountain | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);

  const toggleFavorite = (fountainId: string) => {
    setFountains(prev => prev.map(f => 
      f.id === fountainId ? { ...f, isFavorite: !f.isFavorite } : f
    ));
  };

  // Get user location and search nearby fountains on mount
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          
          // Automatically search for nearby fountains
          try {
            const nearbyResults = await googlePlacesService.searchNearbyFountains(location);
            const nearbyFountains: Fountain[] = nearbyResults.map(place => ({
              id: place.id,
              name: place.name,
              address: place.address,
              distance: calculateDistance(location, { lat: place.lat, lng: place.lng }),
              hours: place.isOpen ? "Öppen nu" : "Stängd",
              isFavorite: false,
              isWorking: place.isOpen,
              rating: place.rating,
              hasPhoto: Boolean(place.photos && place.photos.length > 0),
              lat: place.lat,
              lng: place.lng,
              placeId: place.placeId
            }));

            setFountains(prev => {
              const existingIds = new Set(prev.map(f => f.id));
              const uniqueNearby = nearbyFountains.filter(f => !existingIds.has(f.id));
              return [...prev, ...uniqueNearby];
            });
          } catch (error) {
            console.error("Failed to load nearby fountains:", error);
          }
        },
        () => {
          // Default to Stockholm if geolocation fails
          setUserLocation({ lat: 59.3293, lng: 18.0686 });
        }
      );
    } else {
      setUserLocation({ lat: 59.3293, lng: 18.0686 });
    }
  }, []);

  // Search for fountains using Places API
  const handleSearch = async () => {
    if (!searchQuery.trim() || !userLocation || isSearching) return;
    
    setIsSearching(true);
    try {
      const results = await googlePlacesService.searchFountainsByText(
        searchQuery, 
        userLocation
      );
      
      // Convert PlaceResult to Fountain format
      const newFountains: Fountain[] = results.map(place => ({
        id: place.id,
        name: place.name,
        address: place.address,
        distance: calculateDistance(userLocation, { lat: place.lat, lng: place.lng }),
        hours: place.isOpen ? "Öppen nu" : "Stängd",
        isFavorite: false,
        isWorking: place.isOpen,
        rating: place.rating,
        hasPhoto: Boolean(place.photos && place.photos.length > 0),
        lat: place.lat,
        lng: place.lng,
        placeId: place.placeId
      }));

      setFountains(prev => {
        // Merge with existing fountains, avoiding duplicates
        const existingIds = new Set(prev.map(f => f.id));
        const uniqueNew = newFountains.filter(f => !existingIds.has(f.id));
        return [...prev, ...uniqueNew];
      });
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Calculate distance between two points
  const calculateDistance = (
    point1: google.maps.LatLngLiteral, 
    point2: google.maps.LatLngLiteral
  ): number => {
    const R = 6371; // Earth's radius in km
    const dLat = (point2.lat - point1.lat) * Math.PI / 180;
    const dLng = (point2.lng - point1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(point1.lat * Math.PI / 180) * Math.cos(point2.lat * Math.PI / 180) *
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c * 10) / 10; // Round to 1 decimal
  };

  const filteredFountains = fountains.filter(fountain =>
    fountain.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    fountain.address.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
            <MapPin className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold text-blue-600">Spottet</h1>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Search Bar */}
      <div className="px-4 py-3 bg-white border-b">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input 
              placeholder="Sök efter fontäner eller platser..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="pl-10 pr-10"
            />
            {isSearching && (
              <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 animate-spin" />
            )}
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={handleSearch}
            disabled={isSearching || !searchQuery.trim()}
          >
            {isSearching ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </Button>
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right">
              <SheetHeader>
                <SheetTitle>Filter & Sortering</SheetTitle>
                <SheetDescription>
                  Anpassa vilka fontäner som visas
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-4 mt-6">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Visa endast favoriter</span>
                  <Switch />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Endast funktionella</span>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Öppna nu</span>
                  <Switch />
                </div>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
            <TabsTrigger value="map" className="flex items-center space-x-2">
              <MapPin className="w-4 h-4" />
              <span>Karta</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center space-x-2">
              <List className="w-4 h-4" />
              <span>Lista</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="map" className="flex-1 m-0">
            <GoogleMapsComponent 
              fountains={filteredFountains}
              onFountainSelect={setSelectedFountain}
              selectedFountain={selectedFountain}
              onToggleFavorite={toggleFavorite}
            />
          </TabsContent>

          <TabsContent value="list" className="flex-1 m-0 overflow-y-auto">
            <div className="p-4 space-y-3">
              {filteredFountains.map((fountain) => (
                <Card key={fountain.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <h3 className="font-semibold">{fountain.name}</h3>
                          <Badge variant={fountain.isWorking ? "default" : "destructive"} className="text-xs">
                            {fountain.isWorking ? "Funkar" : "Ur funktion"}
                          </Badge>
                          {fountain.hasPhoto && <Camera className="w-4 h-4 text-gray-400" />}
                        </div>
                        
                        <p className="text-sm text-gray-600 mb-2">{fountain.address}</p>
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <div className="flex items-center space-x-1">
                            <Navigation className="w-3 h-3" />
                            <span>{fountain.distance} km</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Clock className="w-3 h-3" />
                            <span>{fountain.hours}</span>
                          </div>
                          <div className="flex items-center space-x-1">
                            <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                            <span>{fountain.rating}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-2 ml-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleFavorite(fountain.id)}
                        >
                          <Heart 
                            className={`w-4 h-4 ${fountain.isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-400'}`} 
                          />
                        </Button>
                        
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              Visa
                            </Button>
                          </DialogTrigger>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>{fountain.name}</DialogTitle>
                              <DialogDescription>{fountain.address}</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                              <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                  <strong>Öppettider:</strong> {fountain.hours}
                                </div>
                                <div>
                                  <strong>Avstånd:</strong> {fountain.distance} km
                                </div>
                                <div>
                                  <strong>Betyg:</strong> {fountain.rating}/5
                                </div>
                                <div>
                                  <strong>Status:</strong> {fountain.isWorking ? "Funkar" : "Ur funktion"}
                                </div>
                              </div>
                              
                              <div className="flex space-x-2">
                                <Button className="flex-1">
                                  <Navigation className="w-4 h-4 mr-2" />
                                  Navigera
                                </Button>
                                <Button variant="outline" className="flex-1">
                                  <Share className="w-4 h-4 mr-2" />
                                  Dela
                                </Button>
                              </div>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6">
        <Dialog>
          <DialogTrigger asChild>
            <Button size="lg" className="rounded-full shadow-lg">
              <Plus className="w-5 h-5 mr-2" />
              Rapportera
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rapportera Fontän</DialogTitle>
              <DialogDescription>
                Hjälp oss hålla informationen uppdaterad
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Input placeholder="Plats eller adress" />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline">Ny fontän</Button>
                <Button variant="outline">Ur funktion</Button>
              </div>
              <Button className="w-full">Skicka rapport</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
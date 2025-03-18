/* eslint-disable @typescript-eslint/no-explicit-any */
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useSubscription, gql } from "@apollo/client";
import {
  Compass,
  MapPin,
  Navigation,
  Power,
  RefreshCw,
  Trash2,
  Wifi,
} from "lucide-react";

// Replace with your actual API key or use environment variable
const GOOGLE_MAPS_API_KEY = "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0";

const TRACK_SUBSCRIPTION = gql`
  subscription Track($groupId: String!, $imeis: [String!], $topic: String) {
    track(groupId: $groupId, imeis: $imeis, topic: $topic)
  }
`;

// Interface for the tracking data
interface TrackingData {
  imei: string;
  dateTime: string;
  latitude: number;
  longitude: number;
  speed: number;
  bearing: number;
  statusBitsdefinition: {
    ignitionOn: boolean;
    motionState: boolean;
    gps: boolean;
  };
  [key: string]: any;
}

const LiveTracking: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const pathRef = useRef<google.maps.Polyline | null>(null);
  const animationRef = useRef<number | null>(null);
  const previousPositionRef = useRef<google.maps.LatLng | null>(null);
  const targetPositionRef = useRef<google.maps.LatLng | null>(null);
  const previousBearingRef = useRef<number>(0);
  const targetBearingRef = useRef<number>(0);
  const animationStartTimeRef = useRef<number>(0);
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);

  const [pathCoordinates, setPathCoordinates] = useState<google.maps.LatLng[]>(
    []
  );
  const [bounds, setBounds] = useState<google.maps.LatLngBounds | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isMoving, setIsMoving] = useState(false);
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState("status");
  const [isInfoWindowOpen, setIsInfoWindowOpen] = useState(false);

  const { data, loading, error } = useSubscription(TRACK_SUBSCRIPTION, {
    variables: {
      groupId: "live-tracking-consumer",
      imeis: ["700070635323"],
      topic: "live_tracking",
    },
  });

  // Initialize Google Maps
  useEffect(() => {
    const initMap = async () => {
      if (!GOOGLE_MAPS_API_KEY) {
        console.error("Google Maps API key is missing");
        return;
      }

      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
      });

      try {
        const google = await loader.load();

        if (mapRef.current) {
          const newMap = new google.maps.Map(mapRef.current, {
            center: { lat: 28.538536, lng: 77.198824 }, // Default to Delhi
            zoom: 16,
            mapTypeId: google.maps.MapTypeId.ROADMAP,
            mapTypeControl: true,
            fullscreenControl: true,
            streetViewControl: false,
            styles: [
              {
                featureType: "poi",
                elementType: "labels",
                stylers: [{ visibility: "off" }],
              },
            ],
          });

          mapInstanceRef.current = newMap;
          setIsMapLoaded(true);

          // Create bounds for auto-fitting the map
          const newBounds = new google.maps.LatLngBounds();
          setBounds(newBounds);

          // Create polyline for tracking path with improved styling
          const newPath = new google.maps.Polyline({
            path: [],
            geodesic: true,
            strokeColor: "#3b82f6", // Tailwind blue-500
            strokeOpacity: 0.8,
            strokeWeight: 4,
            map: newMap,
          });

          pathRef.current = newPath;

          // Create info window
          infoWindowRef.current = new google.maps.InfoWindow({
            pixelOffset: new google.maps.Size(0, -30),
          });

          // Add info window close listener
          infoWindowRef.current.addListener("closeclick", () => {
            setIsInfoWindowOpen(false);
          });
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    };

    initMap();

    return () => {
      // Clean up animation frame on unmount
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Animation function for smooth marker movement and rotation
  const animateMarkerMovement = (timestamp: number) => {
    if (
      !markerRef.current ||
      !previousPositionRef.current ||
      !targetPositionRef.current
    ) {
      animationRef.current = null;
      return;
    }

    if (animationStartTimeRef.current === 0) {
      animationStartTimeRef.current = timestamp;
    }

    const elapsedTime = timestamp - animationStartTimeRef.current;
    const duration = 2000; // 2 seconds for animation
    const progress = Math.min(elapsedTime / duration, 1);

    // Easing function for smoother animation
    const easedProgress = easeInOutCubic(progress);

    // Use interpolation for smooth movement
    const lat =
      previousPositionRef.current.lat() +
      (targetPositionRef.current.lat() - previousPositionRef.current.lat()) *
        easedProgress;

    const lng =
      previousPositionRef.current.lng() +
      (targetPositionRef.current.lng() - previousPositionRef.current.lng()) *
        easedProgress;

    const currentPosition = new google.maps.LatLng(lat, lng);
    markerRef.current.setPosition(currentPosition);

    // Smoothly rotate marker icon
    const bearing =
      previousBearingRef.current +
      (targetBearingRef.current - previousBearingRef.current) * easedProgress;

    // Update icon rotation
    const icon = markerRef.current.getIcon();
    if (icon && typeof icon === "object") {
      markerRef.current.setIcon({
        ...icon,
        rotation: bearing,
      });
    }

    // Update info window position if open
    if (isInfoWindowOpen && infoWindowRef.current) {
      infoWindowRef.current.setPosition(currentPosition);
    }

    if (progress < 1) {
      // Continue animation
      animationRef.current = requestAnimationFrame(animateMarkerMovement);
    } else {
      // Animation complete
      previousPositionRef.current = targetPositionRef.current;
      previousBearingRef.current = targetBearingRef.current;
      animationStartTimeRef.current = 0;
      animationRef.current = null;
      setIsMoving(false);
    }
  };

  // Easing function for smoother animation
  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Get vehicle icon based on status
  const getVehicleIcon = (ignitionOn: boolean, bearing = 0) => {
    return {
      // Arrow-shaped vehicle icon
      path: "M 0,-10 L 7,7 L 0,3 L -7,7 Z",
      fillColor: ignitionOn ? "#10b981" : "#ef4444", // Tailwind green-500 or red-500
      fillOpacity: 1,
      strokeColor: "#000000",
      strokeWeight: 1,
      rotation: bearing,
      scale: 1.5,
      anchor: new google.maps.Point(0, 0),
    };
  };

  // Process incoming tracking data
  useEffect(() => {
    if (!mapInstanceRef.current || !data?.track || !isMapLoaded) return;

    try {
      const parseData: TrackingData = JSON.parse(data.track);

      if (
        !parseData ||
        typeof parseData.latitude !== "number" ||
        typeof parseData.longitude !== "number"
      ) {
        console.error("Invalid tracking data format:", parseData);
        return;
      }

      // Store tracking data for later use
      setTrackingData(parseData);
      setLastUpdate(new Date());

      const position = {
        lat: parseData.latitude,
        lng: parseData.longitude,
      };

      const latLng = new google.maps.LatLng(position.lat, position.lng);

      // If this is our first position, initialize everything
      if (pathCoordinates.length === 0) {
        previousPositionRef.current = latLng;
        targetPositionRef.current = latLng;
        previousBearingRef.current = parseData.bearing || 0;
        targetBearingRef.current = parseData.bearing || 0;

        // Create the marker
        if (!markerRef.current) {
          const vehicleIcon = getVehicleIcon(
            parseData.statusBitsdefinition?.ignitionOn,
            parseData.bearing
          );

          markerRef.current = new google.maps.Marker({
            map: mapInstanceRef.current,
            position: latLng,
            icon: vehicleIcon,
            title: `Vehicle: ${parseData.imei}`,
            zIndex: 1000, // Ensure marker is above polyline
          });

          // Add marker click listener
          if (markerRef.current) {
            markerRef.current.addListener("click", () => {
              if (infoWindowRef.current && trackingData) {
                infoWindowRef.current.setContent(
                  createInfoWindowContent(trackingData)
                );
                infoWindowRef.current.open(
                  mapInstanceRef.current,
                  markerRef.current
                );
                setIsInfoWindowOpen(true);
              }
            });
          }

          // Initial path setup
          const newPathCoordinates = [latLng];
          setPathCoordinates(newPathCoordinates);

          if (pathRef.current) {
            pathRef.current.setPath(newPathCoordinates);
          }

          // Set bounds
          if (bounds) {
            bounds.extend(latLng);
            mapInstanceRef.current.fitBounds(bounds);
          }
        }
      } else {
        // Only process if position has actually changed
        const lastPos = pathCoordinates[pathCoordinates.length - 1];
        const hasMoved =
          lastPos.lat() !== latLng.lat() || lastPos.lng() !== latLng.lng();

        if (hasMoved) {
          // Cancel any ongoing animation
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
            animationStartTimeRef.current = 0;
          }

          // Set up for new animation
          previousPositionRef.current =
            markerRef.current?.getPosition() as google.maps.LatLng;
          targetPositionRef.current = latLng;
          previousBearingRef.current = targetBearingRef.current; // Use the last target bearing as the starting point
          targetBearingRef.current =
            parseData.bearing || previousBearingRef.current;

          setIsMoving(true);

          // Start animation
          animationRef.current = requestAnimationFrame(animateMarkerMovement);

          // Add to path - only add if there's a meaningful distance change
          const newPathCoordinates = [...pathCoordinates, latLng];

          // Limit path length to prevent performance issues
          const maxPathPoints = 100;
          if (newPathCoordinates.length > maxPathPoints) {
            newPathCoordinates.shift();
          }

          setPathCoordinates(newPathCoordinates);

          // Fix for polyline issue: explicitly set the path with the new coordinates
          if (pathRef.current) {
            // Create a new array to ensure React detects the change
            const updatedPath = [...newPathCoordinates];
            pathRef.current.setPath(updatedPath);
          }

          // Update bounds
          if (bounds && mapInstanceRef.current) {
            bounds.extend(latLng);

            // Only adjust view if tracking is active
            mapInstanceRef.current.fitBounds(bounds);
          }

          // Update marker color based on ignition status (if changed)
          const vehicleIcon = getVehicleIcon(
            parseData.statusBitsdefinition?.ignitionOn,
            parseData.bearing
          );
          if (markerRef.current) {
            markerRef.current.setIcon(vehicleIcon);
          }

          // Update info window content if open
          if (isInfoWindowOpen && infoWindowRef.current) {
            infoWindowRef.current.setContent(
              createInfoWindowContent(parseData)
            );
          }
        }
      }
    } catch (error) {
      console.error("Error processing tracking data:", error);
    }
  }, [data, pathCoordinates, bounds, isMapLoaded, isInfoWindowOpen]);

  // Helper function to create info window content
  const createInfoWindowContent = (data: TrackingData) => {
    const dateTime = new Date(data.dateTime);
    return `
      <div class="p-3 max-w-xs font-sans">
        <h3 class="mb-2 text-base font-semibold text-gray-900">Vehicle Status</h3>
        <div class="space-y-1.5 text-sm">
          <div class="flex justify-between">
            <span class="text-gray-600">IMEI:</span>
            <span class="font-medium text-gray-900">${data.imei}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Time:</span>
            <span class="font-medium text-gray-900">${dateTime.toLocaleString()}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Speed:</span>
            <span class="font-medium text-gray-900">${data.speed} km/h</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Bearing:</span>
            <span class="font-medium text-gray-900">${data.bearing}°</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Location:</span>
            <span class="font-medium text-gray-900">${data.latitude.toFixed(6)}, ${data.longitude.toFixed(6)}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Ignition:</span>
            <span class="font-medium ${data.statusBitsdefinition?.ignitionOn ? "text-green-600" : "text-red-600"}">
              ${data.statusBitsdefinition?.ignitionOn ? "ON" : "OFF"}
            </span>
          </div>
          <div class="flex justify-between">
            <span class="text-gray-600">Motion:</span>
            <span class="font-medium text-gray-900">${data.statusBitsdefinition.motionState ? "Moving" : "Stationary"}</span>
          </div>
        </div>
      </div>
    `;
  };

  // Function to center the map on the current vehicle position
  const centerMap = () => {
    if (mapInstanceRef.current && bounds) {
      mapInstanceRef.current.fitBounds(bounds);
    }
  };

  // Function to clear the path history
  const clearPath = () => {
    if (pathRef.current) {
      // Create a new empty array for the path
      const emptyPath: google.maps.LatLng[] = [];

      // Clear path
      pathRef.current.setPath(emptyPath);
      setPathCoordinates(emptyPath);

      // Reset bounds if needed
      if (markerRef.current && bounds) {
        const position = markerRef.current.getPosition() as google.maps.LatLng;
        bounds.isEmpty();
        bounds.extend(position);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.fitBounds(bounds);
        }
      }
    }
  };

  // Function to get direction text from bearing
  const getDirectionFromBearing = (bearing: number): string => {
    const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
    const index = Math.round(bearing / 45) % 8;
    return directions[index];
  };

  return (
    <div className="space-y-4 p-4 max-w-7xl mx-auto">
      {loading && (
        <div className="flex items-center justify-center p-4 bg-white rounded-md border">
          <RefreshCw className="animate-spin h-5 w-5 mr-3 text-blue-500" />
          <p>Loading tracking data...</p>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-100 text-red-700 rounded-md">
          <p>Error: {error.message}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-xl font-semibold flex items-center">
                <MapPin className="h-5 w-5 mr-2" />
                Live Vehicle Tracking
              </h2>
            </div>
            <div className="p-4">
              <div
                ref={mapRef}
                className="w-full h-[500px] rounded-md overflow-hidden"
                aria-label="Google Map showing vehicle location"
              />
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={centerMap}
                  className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Navigation className="h-4 w-4 mr-2" />
                  Center Map
                </button>
                <button
                  onClick={clearPath}
                  className="flex items-center px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Clear Path
                </button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-200">
              <h2 className="text-xl font-semibold">Vehicle Information</h2>
            </div>
            <div className="p-4">
              {trackingData ? (
                <div>
                  <div className="flex border-b">
                    <button
                      className={`px-4 py-2 font-medium text-sm ${activeTab === "status" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                      onClick={() => setActiveTab("status")}
                    >
                      Status
                    </button>
                    <button
                      className={`px-4 py-2 font-medium text-sm ${activeTab === "system" ? "text-blue-600 border-b-2 border-blue-600" : "text-gray-500 hover:text-gray-700"}`}
                      onClick={() => setActiveTab("system")}
                    >
                      System
                    </button>
                  </div>

                  {activeTab === "status" && (
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 rounded-lg">
                          <Navigation className="h-6 w-6 mb-2 text-blue-600" />
                          <div className="text-sm font-medium">Speed</div>
                          <div className="text-2xl font-bold">
                            {trackingData.speed}
                          </div>
                          <div className="text-xs text-gray-500">km/h</div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 rounded-lg">
                          <Compass className="h-6 w-6 mb-2 text-blue-600" />
                          <div className="text-sm font-medium">Heading</div>
                          <div className="text-2xl font-bold">
                            {trackingData.bearing}°
                          </div>
                          <div className="text-xs text-gray-500">
                            {getDirectionFromBearing(trackingData.bearing)}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Status:</span>
                          <span
                            className={`px-2 py-1 text-xs rounded-full ${isMoving ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}
                          >
                            {isMoving ? "Moving" : "Stationary"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Location:</span>
                          <span className="text-sm font-medium">
                            {trackingData.latitude.toFixed(6)},{" "}
                            {trackingData.longitude.toFixed(6)}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">IMEI:</span>
                          <span className="text-sm font-medium">
                            {trackingData.imei}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "system" && (
                    <div className="space-y-4 pt-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 rounded-lg">
                          <Power
                            className={`h-6 w-6 mb-2 ${
                              trackingData.statusBitsdefinition?.ignitionOn
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          />
                          <div className="text-sm font-medium">Ignition</div>
                          <div className="text-xl font-bold">
                            {trackingData.statusBitsdefinition?.ignitionOn
                              ? "ON"
                              : "OFF"}
                          </div>
                        </div>
                        <div className="flex flex-col items-center justify-center p-3 bg-gray-100 rounded-lg">
                          <Wifi
                            className={`h-6 w-6 mb-2 ${
                              trackingData.statusBitsdefinition?.gps
                                ? "text-green-500"
                                : "text-red-500"
                            }`}
                          />
                          <div className="text-sm font-medium">GPS</div>
                          <div className="text-xl font-bold">
                            {trackingData.statusBitsdefinition?.gps
                              ? "Active"
                              : "Inactive"}
                          </div>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm flex items-center">
                            <RefreshCw className="h-4 w-4 mr-1" />
                            Last Update:
                          </span>
                          <span className="text-sm font-medium">
                            {lastUpdate
                              ? lastUpdate.toLocaleTimeString()
                              : "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm">Date:</span>
                          <span className="text-sm font-medium">
                            {lastUpdate
                              ? lastUpdate.toLocaleDateString()
                              : "N/A"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-[300px] text-gray-400">
                  <MapPin className="h-12 w-12 mb-4 opacity-20" />
                  <p>Waiting for tracking data...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveTracking;

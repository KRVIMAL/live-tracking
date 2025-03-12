import { useEffect, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { useSubscription, gql } from "@apollo/client";
import {client} from "../../core-services/graphql/apollo-client"
const GOOGLE_MAPS_API_KEY = "YOUR_GOOGLE_MAPS_API_KEY";

const TRACK_SUBSCRIPTION = gql`
  subscription Track($groupId: String!, $imeis: [String!], $topic: String) {
    track(groupId: $groupId, imeis: $imeis, topic: $topic)
  }
`;

const LiveTracking: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [marker, setMarker] = useState<google.maps.Marker | null>(null);

  const { data } = useSubscription(TRACK_SUBSCRIPTION, {
    variables: { groupId: "your-group-id", imeis: ["your-imei"], topic: "track" },
    client,
  });

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
      });

      try {
        const google = await loader.load();
        if (mapRef.current) {
          const newMap = new google.maps.Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
          });
          setMap(newMap);
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error);
      }
    };

    initMap();
  }, []);

  useEffect(() => {
    if (data?.track) {
      try {
        const trackData = JSON.parse(data.track);
        const { latitude, longitude } = trackData;

        if (map) {
          if (marker) {
            marker.setPosition({ lat: latitude, lng: longitude });
          } else {
            const newMarker = new google.maps.Marker({
              position: { lat: latitude, lng: longitude },
              map: map,
            });
            setMarker(newMarker);
          }
          map.setCenter({ lat: latitude, lng: longitude });
        }
      } catch (error) {
        console.error("Error parsing tracking data:", error);
      }
    }
  }, [data, map]);

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />;
};

export default LiveTracking;

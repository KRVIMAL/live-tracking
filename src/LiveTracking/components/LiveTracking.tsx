import type React from "react"
import { useEffect, useRef } from "react"
import { Loader } from "@googlemaps/js-api-loader"

const GOOGLE_MAPS_API_KEY = "AIzaSyAaZ1M_ofwVoLohowruNhY0fyihH9NpcI0"

const LiveTracking: React.FC = () => {
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const initMap = async () => {
      const loader = new Loader({
        apiKey: GOOGLE_MAPS_API_KEY,
        version: "weekly",
      })

      try {
        const google = await loader.load()
        if (mapRef.current) {
          new google.maps.Map(mapRef.current, {
            center: { lat: 0, lng: 0 },
            zoom: 2,
          })
        }
      } catch (error) {
        console.error("Error loading Google Maps:", error)
      }
    }

    initMap()
  }, [])

  return <div ref={mapRef} style={{ width: "100%", height: "100%" }} />
}

export default LiveTracking


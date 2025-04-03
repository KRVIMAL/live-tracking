import { gql, useSubscription } from "@apollo/client";
import toast, { Toaster } from "react-hot-toast";
import { useEffect, useRef } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import LiveTracking from "./LiveTracking/components/LiveTracking";
import { useParams } from "react-router-dom";

// GraphQL subscription for tracking
const TRACK_SUBSCRIPTION = gql`
  subscription Track($groupId: String!, $imeis: [String!], $topic: String) {
    track(groupId: $groupId, imeis: $imeis, topic: $topic)
  }
`;

const App: React.FC = () => {
  // Use a ref to store the last received alert to prevent duplicates
  const params = useParams();
  const imei = params.imei;
  const lastAlertRef = useRef<Record<string, string>>({});

  // Subscribe to live alerts
  const { data: alertData } = useSubscription(TRACK_SUBSCRIPTION, {
    variables: {
      groupId: "live-alert-consumer",
      imeis: [imei],
      topic: "live_alert",
    },
    onError: (error) => {
      console.error("Alert subscription error:", error);
    },
  });

  // Subscribe to live tracking (if needed)
  const { data: trackingData } = useSubscription(TRACK_SUBSCRIPTION, {
    variables: {
      groupId: "live-tracking-consumer",
      imeis: [imei],
      topic: "live_tracking",
    },
    onError: (error) => {
      console.error("Tracking subscription error:", error);
    },
  });

  // Process alert data
  useEffect(() => {
    if (alertData?.track) {
      try {
        console.log("Alert data received:", alertData.track);
        const trackJson = JSON.parse(alertData.track);
        const imei = trackJson?.imei;

        if (imei) {
          // Create a unique key for this alert
          const messageKey = `${imei}-${trackJson.alertMessage || ""}-${Date.now()}`;

          // Check if we've already seen an identical alert message for this IMEI
          const lastMessage = lastAlertRef.current[imei];
          const currentMessage = trackJson.alertMessage || "";

          if (!lastMessage || lastMessage !== currentMessage) {
            // Only show if this is a new message
            toast.error(`${trackJson?.alertMessage || "Alert"} - ${imei}`, {
              duration: 5000,
              id: messageKey,
            });

            // Update the last message for this IMEI
            lastAlertRef.current[imei] = currentMessage;
            console.log("Alert displayed for IMEI:", imei);
          } else {
            console.log("Duplicate alert skipped for IMEI:", imei);
          }
        }
      } catch (error) {
        console.error("Error processing alert data:", error);
      }
    }
  }, [alertData]);

  // Process tracking data (if needed)
  // useEffect(() => {
  //   if (trackingData?.track) {
  //     try {
  //       const trackJson = JSON.parse(trackingData.track);
  //       console.log("Tracking data received for IMEI:", trackJson?.imei);

  //       // Add your tracking data processing logic here
  //       // For example: update a map with the new location
  //     } catch (error) {
  //       console.error("Error processing tracking data:", error);
  //     }
  //   }
  // }, [trackingData]);

  return (
    <div style={{ width: "100vw", height: "100vh" }}>
      <Toaster
        position="top-center"
        toastOptions={{
          // Customize toast appearance
          style: {
            padding: "12px 16px",
            borderRadius: "8px",
          },
        }}
      />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={
            <>
              <h1>Live Alert Testing</h1>
              <div>
                <h2>Status</h2>
                <p>Live Alert Service: {alertData ? "Connected" : "Connecting..."}</p>
                <p>
                  Live Tracking Service: {trackingData ? "Connected" : "Connecting..."}
                </p>
              </div>
              <LiveTracking />
            </>
          } />
          <Route path="/live-tracking/:imei" element={<LiveTracking />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
};

export default App;
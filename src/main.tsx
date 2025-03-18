import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { ApolloProvider } from "@apollo/client";
import { liveClient } from "./core-services/graphql/apollo-client.ts";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ApolloProvider client={liveClient}>
      <App />
    </ApolloProvider>
  </StrictMode>
);

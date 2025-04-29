/* eslint-disable no-loop-func */
/* eslint-disable no-console */
import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  split,
  from,
} from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { WebSocketLink } from "@apollo/client/link/ws";
import { HttpLink } from "@apollo/client/link/http";

const httpLink = new HttpLink({
  uri: `http://192.168.1.24:9090/graphql`,
});

const wsLink = new WebSocketLink({
  uri: `ws://192.168.1.24:9090/subscriptions`,
  options: {
    reconnect: true,
  },
});

const link = split(
  ({ query }) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink,
  httpLink
);

export const liveClient = new ApolloClient({
  link: from([link]),
  cache: new InMemoryCache(),
});

export { ApolloProvider };

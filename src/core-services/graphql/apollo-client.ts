import { ApolloClient, InMemoryCache, split } from "@apollo/client";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";
import { getMainDefinition } from "@apollo/client/utilities";

const wsLink = new GraphQLWsLink(
  createClient({
    url: `ws://your-graphql-server/subscriptions`,
  })
);

const splitLink = split(
  ({ query }:any) => {
    const definition = getMainDefinition(query);
    return (
      definition.kind === "OperationDefinition" &&
      definition.operation === "subscription"
    );
  },
  wsLink
);

export const client = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
});

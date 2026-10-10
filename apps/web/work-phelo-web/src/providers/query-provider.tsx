'use client';

import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { useState } from 'react';
import { shouldRetryQuery } from '@/lib/queryRetry';

function createClient() {
  const client: QueryClient = new QueryClient({
    // Whatever changes, the page of transactions on screen (if any) is read again: it merges
    // several kinds of record, so no single mutation owns it.
    mutationCache: new MutationCache({
      onSuccess: () => {
        void client.invalidateQueries({ queryKey: ['accounting', 'transactions-page'] });
      },
    }),
    defaultOptions: {
      queries: {
        retry: shouldRetryQuery,
        staleTime: 1000 * 60 * 5,
      },
    },
  });
  return client;
}

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(createClient);

  return (
    <QueryClientProvider client={client}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

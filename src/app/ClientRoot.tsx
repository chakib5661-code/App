'use client';

import dynamic from "next/dynamic";

// The storefront relies on browser-only APIs (localStorage, IndexedDB, service workers),
// so it is rendered on the client only.
const Root = dynamic(() => import("./Root"), { ssr: false });

export default function ClientRoot() {
  return <Root />;
}

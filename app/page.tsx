import { Suspense } from "react";
import DiscoveryPrototype from "@/app/discovery-prototype";

export default function Home() {
  return <Suspense fallback={<p>Opening the Habitta district…</p>}><DiscoveryPrototype /></Suspense>;
}

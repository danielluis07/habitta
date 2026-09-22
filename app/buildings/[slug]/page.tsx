import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Exploration } from "@/components/exploration";
import { collection, getConcept } from "@/lib/collection";

// A shareable link to one building's overview. It renders the same district
// page as `/`, opened on that building, so it works before or without 3D.

export const dynamicParams = false;

export function generateStaticParams() {
  return collection.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/buildings/[slug]">): Promise<Metadata> {
  const concept = getConcept((await params).slug);
  if (!concept) return {};

  const { name, description } = concept.building;
  return {
    title: name,
    description,
    openGraph: {
      type: "website",
      siteName: "Habitta",
      title: `${name} · Habitta`,
      description,
      locale: "en",
    },
  };
}

export default async function BuildingPage({ params }: PageProps<"/buildings/[slug]">) {
  const concept = getConcept((await params).slug);
  if (!concept) notFound();

  return <Exploration initialStage={{ name: "building", slug: concept.slug }} />;
}

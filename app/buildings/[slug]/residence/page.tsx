import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Exploration } from "@/components/exploration";
import { collection, getConcept } from "@/lib/collection";

// A shareable link to one building's featured residence story. The story is
// part of the same district page, opened at the residence stage, so it is
// server-rendered in full and works before or without 3D.

export const dynamicParams = false;

export function generateStaticParams() {
  return collection.map(({ slug }) => ({ slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/buildings/[slug]/residence">): Promise<Metadata> {
  const concept = getConcept((await params).slug);
  if (!concept) return {};

  const { building, featuredResidence: residence, visualizations } = concept;
  const title = `${residence.name} residence in ${building.name}`;
  const description = `${residence.name}, the featured residence of ${building.name}, is an imagined Habitta concept. ${residence.designIdea}`;
  const preview = visualizations.living;
  const images = [
    { url: preview.src, width: preview.width, height: preview.height, alt: preview.alt },
  ];

  return {
    title,
    description,
    openGraph: {
      type: "article",
      siteName: "Habitta",
      title: `${title} · Habitta`,
      description,
      locale: "en",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Habitta`,
      description,
      images,
    },
  };
}

export default async function ResidencePage({ params }: PageProps<"/buildings/[slug]/residence">) {
  const concept = getConcept((await params).slug);
  if (!concept) notFound();

  return <Exploration initialStage={{ name: "residence", slug: concept.slug }} />;
}

import Image from "next/image";
import type { ConceptImage } from "@/lib/collection";

type ConceptStillProps = {
  image: ConceptImage;
  sizes: string;
};

export function ConceptStill({ image, sizes }: ConceptStillProps) {
  return (
    <figure className="relative">
      <Image
        src={image.src}
        alt={image.alt}
        width={image.width}
        height={image.height}
        sizes={sizes}
        className="aspect-3/2 h-auto w-full object-cover"
      />
      {image.placeholder ? (
        <figcaption className="absolute top-3 left-3 rounded-sm border border-border-control bg-paper-raised px-2 py-1 type-eyebrow text-ink-muted">
          Placeholder
        </figcaption>
      ) : null}
    </figure>
  );
}

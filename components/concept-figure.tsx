import Image from "next/image";
import type { ReactNode } from "react";
import type { ConceptImage } from "@/lib/collection";
import { cn } from "@/lib/utils";

type ConceptFigureProps = {
  image: ConceptImage;
  sizes: string;
  /** Aspect and crop for the image. Without it the image keeps its own proportions. */
  imageClassName?: string;
  caption?: ReactNode;
  captionClassName?: string;
  /** Fetch ahead of other images, for an opening image. */
  eager?: boolean;
  className?: string;
};

export function ConceptFigure({
  image,
  sizes,
  imageClassName,
  caption,
  captionClassName,
  eager = false,
  className,
}: ConceptFigureProps) {
  return (
    <figure className={className}>
      <div className="relative">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes={sizes}
          loading={eager ? "eager" : undefined}
          fetchPriority={eager ? "high" : undefined}
          className={cn("h-auto w-full", imageClassName)}
        />
        {image.placeholder ? (
          <span className="absolute top-3 left-3 rounded-sm border border-border-control bg-paper-raised px-2 py-1 type-eyebrow text-ink-muted">
            Placeholder
          </span>
        ) : null}
      </div>
      {caption ? <figcaption className={cn("mt-3", captionClassName)}>{caption}</figcaption> : null}
    </figure>
  );
}

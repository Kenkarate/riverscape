import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/animations";

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "center",
  light = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  align?: "center" | "left";
  light?: boolean;
}) {
  return (
    <FadeIn
      className={cn(
        "max-w-2xl",
        align === "center" ? "mx-auto text-center" : "text-left"
      )}
    >
      {eyebrow && (
        <span
          className={cn(
            "mb-3 inline-block text-xs font-semibold uppercase tracking-[0.25em]",
            light ? "text-gold-light" : "text-gold-dark"
          )}
        >
          {eyebrow}
        </span>
      )}
      <h2
        className={cn(
          "text-4xl leading-tight sm:text-5xl",
          light ? "text-cream" : "text-forest"
        )}
      >
        {title}
      </h2>
      {description && (
        <p
          className={cn(
            "mt-4 text-base leading-relaxed sm:text-lg",
            light ? "text-cream/70" : "text-forest/70"
          )}
        >
          {description}
        </p>
      )}
    </FadeIn>
  );
}

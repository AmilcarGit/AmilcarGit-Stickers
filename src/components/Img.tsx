/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

/** <img> simple: los stickers son WebP ya optimizados y las miniaturas son data URLs. */
export function Img({ alt, ...rest }: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  return <img loading="lazy" decoding="async" alt={alt} {...rest} />;
}

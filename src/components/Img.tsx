/* eslint-disable @next/next/no-img-element */
import type { ImgHTMLAttributes } from "react";

/** <img> simple: los stickers son WebP ya optimizados y los miniaturas son data URLs. */
export function Img(props: ImgHTMLAttributes<HTMLImageElement> & { alt: string }) {
  return <img loading="lazy" decoding="async" {...props} />;
}

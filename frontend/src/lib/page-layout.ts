import type { NextPage } from "next";
import type { ReactElement, ReactNode } from "react";

/** A page that can wrap itself in a shared layout which persists across client navigations. */
export type PageWithLayout<P = Record<string, never>> = NextPage<P> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

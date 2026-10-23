import { useRouter as useNextRouter } from "next/router";

/** Router actions the app uses; the same shape as the App Router's `useRouter`. */
export function useRouter() {
  return useNextRouter();
}

/** The current URL path without query string or hash, like the App Router's `usePathname`. */
export function usePathname(): string {
  const { asPath } = useNextRouter();
  return asPath.split(/[?#]/)[0];
}

import { ColorSchemeScript, mantineHtmlProps } from "@mantine/core";
import { Head, Html, Main, NextScript } from "next/document";

import { NORMALIZE_COLOR_SCHEME_SCRIPT } from "@/features/board/utils/color-scheme";

export default function Document() {
  return (
    <Html lang="en" {...mantineHtmlProps}>
      <Head>
        <meta
          name="description"
          content="A personal workspace for managing tasks, statuses, and daily life."
        />
        <link rel="icon" href="/favicon.ico" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,100..900&family=Manrope:wght@200..800&display=swap"
        />
        <script dangerouslySetInnerHTML={{ __html: NORMALIZE_COLOR_SCHEME_SCRIPT }} />
        <ColorSchemeScript defaultColorScheme="light" />
      </Head>
      <body className="antialiased">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}

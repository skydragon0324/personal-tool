import type { AppProps } from "next/app";
import Head from "next/head";

import { Providers } from "@/features/shell/components/providers";
import { t } from "@/i18n";
import type { PageWithLayout } from "@/lib/page-layout";

import "@/styles/tailwind-base.css";
import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";
import "@mantine/tiptap/styles.css";
import "@/styles/globals.css";

type AppPropsWithLayout = AppProps & { Component: PageWithLayout };

export default function App({ Component, pageProps }: AppPropsWithLayout) {
  const getLayout = Component.getLayout ?? ((page) => page);

  return (
    <>
      <Head>
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width" />
      </Head>
      <Providers>
        <AppTitle />
        {getLayout(<Component {...pageProps} />)}
      </Providers>
    </>
  );
}

/** The default tab title, in the current language (pages such as a board set their own). */
function AppTitle() {
  return (
    <Head>
      <title>{t("common.appName")}</title>
    </Head>
  );
}

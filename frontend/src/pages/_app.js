import { useEffect } from "react";
import { useRouter } from "next/router";
import { store } from "@/config/redux/store";
import "@/styles/globals.css";
import { Provider } from "react-redux";
import Head from "next/head";
import { ToastProvider } from "@/Components/Toast";
import { NotificationProvider } from "@/Components/NotificationProvider";
import { CallProvider } from "@/Components/CallProvider";
import posthog, { initPosthog } from "@/config/posthog";

export default function App({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    initPosthog();
    const handleRouteChange = () => posthog.capture("$pageview");
    router.events.on("routeChangeComplete", handleRouteChange);
    return () => router.events.off("routeChangeComplete", handleRouteChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Head>
        {/* Prevents zooming on mobile to give an "App" feel */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"
        />
        <title>Mitrata</title>
      </Head>

      <Provider store={store}>
        <ToastProvider>
          <NotificationProvider>
            <CallProvider>
              <Component {...pageProps} />
            </CallProvider>
          </NotificationProvider>
        </ToastProvider>
      </Provider>
    </>
  );
}

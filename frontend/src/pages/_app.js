import { store } from "@/config/redux/store";
import "@/styles/globals.css";
import { Provider } from "react-redux";
import Head from "next/head";
import { ToastProvider } from "@/Components/Toast";
import { NotificationProvider } from "@/Components/NotificationProvider";
import { CallProvider } from "@/Components/CallProvider";

export default function App({ Component, pageProps }) {
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

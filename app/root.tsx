import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "@remix-run/react";
import { json } from "@remix-run/node";
import type { LinksFunction, LoaderFunctionArgs } from "@remix-run/node";
import polarisStyles from "@shopify/polaris/build/esm/styles.css";
import { AppProvider } from "@shopify/polaris";
import { authenticate } from "./shopify.server";

export const links: LinksFunction = () => [
  { rel: "stylesheet", href: polarisStyles },
];

export async function loader({ request }: LoaderFunctionArgs) {
  await authenticate.admin(request);

  // Import Polaris translations dynamically
  const polarisTranslations = await import("@shopify/polaris/locales/en.json").then(
    (module) => module.default
  );

  return json({
    apiKey: process.env.SHOPIFY_API_KEY || "",
    polarisTranslations,
  });
}

export default function App() {
  const { apiKey, polarisTranslations } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        <AppProvider
          apiKey={apiKey}
          i18n={polarisTranslations}
        >
          <Outlet />
        </AppProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
        {process.env.NODE_ENV === "production" && process.env.CLARITY_ID && (
          <script
            dangerouslySetInnerHTML={{
              __html: `
                (function(c,l,a,r,i,t,y){
                    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
                    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
                    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
                })(window, document, "clarity", "script", "${process.env.CLARITY_ID}");
              `,
            }}
          />
        )}
      </body>
    </html>
  );
}
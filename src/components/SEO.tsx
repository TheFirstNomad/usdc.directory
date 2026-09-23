import { Helmet } from "react-helmet-async";

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  type?: string;
  image?: string;
  jsonLd?: Record<string, any> | Record<string, any>[];
}


const SITE_URL = "https://usdc.directory";
const SITE_NAME = "USDC Directory";
const DEFAULT_TITLE = "USDC Directory: Merchants & Services Accepting USDC";
const DEFAULT_DESCRIPTION =
  "Discover trusted merchants, B2B services, and AI-driven platforms accepting USDC worldwide. List your entity for just 10 USDC.";

const SEO = ({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  type = "website",
  image,
  jsonLd,
}: SEOProps) => {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : DEFAULT_TITLE;
  const url = `${SITE_URL}${path}`;
  const isHome = path === "/";
  const ogImage = image || `${SITE_URL}/og-default.png`;


  // Sitewide schema only on the homepage to avoid duplicate JSON-LD on every route.
  const homeJsonLd = isHome
    ? [
        {
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: SITE_NAME,
          url: SITE_URL,
          description: DEFAULT_DESCRIPTION,
          potentialAction: {
            "@type": "SearchAction",
            target: {
              "@type": "EntryPoint",
              urlTemplate: `${SITE_URL}/?q={search_term_string}`,
            },
            "query-input": "required name=search_term_string",
          },
        },
        {
          "@context": "https://schema.org",
          "@type": "Organization",
          name: SITE_NAME,
          url: SITE_URL,
          description:
            "The #1 directory for the global USDC economy, connecting merchants, B2B services, and AI-driven platforms.",
        },
      ]
    : [];

  const customJsonLd = jsonLd
    ? Array.isArray(jsonLd)
      ? jsonLd
      : [jsonLd]
    : [];
  const allJsonLd = [...homeJsonLd, ...customJsonLd];

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={url} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:image" content={ogImage} />

      {/* Twitter */}
      <meta name="twitter:card" content={image ? "summary_large_image" : "summary"} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />


      {allJsonLd.map((schema, i) => (
        <script key={i} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEO;

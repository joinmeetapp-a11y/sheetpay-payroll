import React, { useEffect } from 'react';
import { CalculatorPageConfig, FAQItem } from '../../lib/calculators/registry';

interface SEOHeadProps {
  config: {
    title: string;
    description: string;
    canonicalPath: string;
    h1?: string;
    breadcrumbs?: { name: string; path: string }[];
    faqs?: FAQItem[];
    calculatorConfig?: CalculatorPageConfig;
  };
}

export const SEOHead: React.FC<SEOHeadProps> = ({ config }) => {
  useEffect(() => {
    // 1. Update Document Title
    document.title = config.title;

    // 2. Helper to set or update meta tags
    const setMetaTag = (name: string, content: string, isProperty = false) => {
      const attr = isProperty ? 'property' : 'name';
      let element = document.querySelector(`meta[${attr}="${name}"]`) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement('meta');
        element.setAttribute(attr, name);
        document.head.appendChild(element);
      }
      element.setAttribute('content', content);
    };

    // 3. Set standard meta tags
    setMetaTag('description', config.description);
    setMetaTag('og:title', config.title, true);
    setMetaTag('og:description', config.description, true);
    setMetaTag('og:type', 'website', true);
    setMetaTag('twitter:title', config.title);
    setMetaTag('twitter:description', config.description);
    setMetaTag('twitter:card', 'summary_large_image');

    // 4. Update or create canonical link
    const canonicalUrl = `https://sheetpay.app${config.canonicalPath}`;
    setMetaTag('og:url', canonicalUrl, true);

    let canonicalLink = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonicalLink) {
      canonicalLink = document.createElement('link');
      canonicalLink.setAttribute('rel', 'canonical');
      document.head.appendChild(canonicalLink);
    }
    canonicalLink.setAttribute('href', canonicalUrl);

    // 5. Inject Structured Data (JSON-LD)
    const scriptId = 'sheetpay-seo-schema-jsonld';
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = scriptId;
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }

    const schemas: any[] = [];

    // WebApplication Schema
    if (config.calculatorConfig) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: config.calculatorConfig.h1,
        url: canonicalUrl,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        browserRequirements: 'Requires JavaScript. Requires HTML5.',
        description: config.calculatorConfig.shortDescription,
        offers: {
          '@type': 'Offer',
          price: '0.00',
          priceCurrency: config.calculatorConfig.currency,
        },
        creator: {
          '@type': 'Organization',
          name: 'Sheetpay',
          url: 'https://sheetpay.app',
          logo: 'https://sheetpay.app/logo.png',
        },
      });
    }

    // BreadcrumbList Schema
    if (config.breadcrumbs && config.breadcrumbs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: config.breadcrumbs.map((crumb, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          name: crumb.name,
          item: `https://sheetpay.app${crumb.path}`,
        })),
      });
    }

    // FAQPage Schema
    if (config.faqs && config.faqs.length > 0) {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: config.faqs.map((faq) => ({
          '@type': 'Question',
          name: faq.question,
          acceptedAnswer: {
            '@type': 'Answer',
            text: faq.answer,
          },
        })),
      });
    }

    scriptTag.textContent = JSON.stringify(schemas.length === 1 ? schemas[0] : { '@context': 'https://schema.org', '@graph': schemas });

    return () => {
      // Clean up if unmounted
    };
  }, [config]);

  return null;
};

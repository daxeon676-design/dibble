/**
 * SEO utilities for generating structured data and metadata
 */

interface ProductSchemaData {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  imageUrls: string[];
  sellerName: string;
  sellerId: string;
  rating?: number;
  reviewCount?: number;
  stock: number;
}

interface OrganizationSchema {
  name: string;
  description: string;
  url: string;
  logo: string;
  sameAs?: string[];
}

export function generateProductSchema(product: ProductSchemaData, baseUrl: string) {
  const price = (product.priceCents / 100).toFixed(2);
  
  return {
    "@context": "https://schema.org/",
    "@type": "Product",
    name: product.title,
    description: product.description.substring(0, 160),
    image: product.imageUrls[0] || `${baseUrl}/og-image.png`,
    offers: {
      "@type": "Offer",
      url: `${baseUrl}/product/${product.id}`,
      priceCurrency: "GBP",
      price: price,
      availability: product.stock > 0 ? "InStock" : "OutOfStock",
      seller: {
        "@type": "Organization",
        name: product.sellerName,
        url: `${baseUrl}/seller/${product.sellerId}`,
      },
    },
    ...(product.rating && product.reviewCount && {
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: product.rating,
        reviewCount: product.reviewCount,
      },
    }),
  };
}

export function generateOrganizationSchema(org: OrganizationSchema) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: org.name,
    description: org.description,
    url: org.url,
    logo: org.logo,
    ...(org.sameAs && {
      sameAs: org.sameAs,
    }),
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "Customer Service",
      email: "support@dibble.farm",
    },
  };
}

export function generateBreadcrumbSchema(items: Array<{ name: string; url: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function generateLocalBusinessSchema(baseUrl: string) {
  return {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    name: "Dibble",
    description: "Marketplace for fresh produce by local makers",
    url: baseUrl,
    image: `${baseUrl}/og-image.png`,
    priceRange: "£",
    telephone: "in your area",
    address: {
      "@type": "PostalAddress",
      streetAddress: "Online Marketplace",
      addressCountry: "GB",
    },
  };
}

export function generateFAQSchema(
  questions: Array<{
    question: string;
    answer: string;
  }>
) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: questions.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

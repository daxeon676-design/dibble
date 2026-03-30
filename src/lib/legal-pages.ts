import fs from "node:fs/promises";
import path from "node:path";

export type LegalFaqItem = {
  q: string;
  a: string;
};

export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalPagesContent = {
  about: {
    title: string;
    subtitle: string;
    body: string;
    contactEmail: string;
  };
  faq: {
    title: string;
    intro: string;
    contactEmail: string;
    items: LegalFaqItem[];
  };
  terms: {
    title: string;
    lastUpdated: string;
    sections: LegalSection[];
  };
  privacy: {
    title: string;
    lastUpdated: string;
    sections: LegalSection[];
  };
};

const dataDir = path.join(process.cwd(), "data");
const legalPagesPath = path.join(dataDir, "legal-pages.json");

async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonFile<T>(filePath: string, value: T) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(value, null, 2), "utf8");
}

function getDefaultLegalPagesContent(): LegalPagesContent {
  return {
    about: {
      title: "About Dibble",
      subtitle: "A marketplace for handmade and craft products from local makers.",
      body:
        "Dibble helps independent makers, artists, and small craft studios sell directly to their local communities. From ceramics and prints to textiles, home decor, and gifts, our focus is quality handmade products with real stories behind them.\n\nOur mission is simple: make it easier for local creators to grow sustainable businesses and easier for buyers to discover meaningful, well-made products from nearby people.\n\nEvery shop on Dibble is run by a real person. We provide the tools for listings, payments, fulfillment updates, and customer communication so makers can spend more time creating and less time juggling admin.",
      contactEmail: "contact@dibblemarketplace.com",
    },
    faq: {
      title: "Frequently Asked Questions",
      intro: "Need help with something on Dibble? Start here.",
      contactEmail: "contact@dibblemarketplace.com",
      items: [
        {
          q: "What can I buy on Dibble?",
          a: "Dibble features handmade and craft products from local independent makers, including ceramics, prints, textiles, home decor, gifts, and more.",
        },
        {
          q: "How do I become a seller?",
          a: "Create an account and submit a seller application with your shop details. Once approved by admin, you can list products and start selling.",
        },
        {
          q: "How are payments handled?",
          a: "Payments are processed securely through Stripe. Card details are never stored on Dibble servers.",
        },
        {
          q: "How does Dibble handle cookies and consent?",
          a: "We use essential cookies for security and sign-in, and request consent before any non-essential cookies are used. You can review details in our Cookie and Privacy Policies.",
        },
        {
          q: "How do shipping and delivery updates work?",
          a: "Sellers choose their delivery options and update order status as items move from processing to shipped and delivered.",
        },
        {
          q: "What if there is an issue with my order?",
          a: "Contact the seller first through Dibble messages. If unresolved, raise a dispute and our admin team will review it.",
        },
      ],
    },
    terms: {
      title: "Terms & Conditions",
      lastUpdated: "March 2026",
      sections: [
        {
          heading: "1. Acceptance of Terms",
          body: "By creating an account or purchasing through Dibble, you agree to these Terms & Conditions.",
        },
        {
          heading: "2. Marketplace Role",
          body: "Dibble is a marketplace connecting buyers and independent sellers of handmade and craft products. Sellers are responsible for their listings, product accuracy, and fulfillment.",
        },
        {
          heading: "3. Buyer Obligations",
          body: "Buyers should review listings carefully before purchase and provide accurate delivery details.",
        },
        {
          heading: "4. Seller Obligations",
          body: "Sellers must list products they are authorized to sell, provide accurate descriptions, and dispatch orders within stated timelines.",
        },
        {
          heading: "5. Payments, Fees, and Payouts",
          body: "Payments are processed by Stripe. Dibble may deduct platform fees before issuing seller payouts as documented in seller settings.",
        },
        {
          heading: "6. Consumer Rights and Cancellations",
          body: "Where UK consumer law applies, buyers retain statutory rights under the Consumer Rights Act 2015 and related regulations. Handmade and made-to-order products may have specific cancellation or return exceptions where legally permitted and clearly stated at purchase.",
        },
        {
          heading: "7. Disputes and Resolution",
          body: "If buyers and sellers cannot resolve an issue directly, either party may open a dispute. Admin decisions are final for platform moderation purposes and do not limit statutory legal rights.",
        },
        {
          heading: "8. Changes and Governing Law",
          body: "We may update these terms periodically. These terms are governed by the laws of England and Wales unless mandatory local law requires otherwise.",
        },
      ],
    },
    privacy: {
      title: "Privacy Policy",
      lastUpdated: "March 2026",
      sections: [
        {
          heading: "1. What We Collect",
          body: "We collect account information, order and payment metadata, message data, and technical logs needed to run the marketplace. This may include identifiers, contact details, transaction records, and customer support records.",
        },
        {
          heading: "2. UK GDPR Lawful Bases",
          body: "Under UK GDPR and the Data Protection Act 2018, we process personal data using lawful bases including contract performance, legitimate interests (such as fraud prevention and service security), legal obligations, and consent where required.",
        },
        {
          heading: "3. How We Use Data",
          body: "We use data to operate Dibble, process purchases, support sellers and buyers, prevent abuse, provide customer service, and comply with legal obligations.",
        },
        {
          heading: "4. Cookies and PECR",
          body: "We use essential cookies for core functionality and security. Non-essential cookies are used only with consent in line with PECR. See our Cookie Policy for details.",
        },
        {
          heading: "5. Payment Processing",
          body: "Card payments are processed by Stripe. Dibble does not store full card details.",
        },
        {
          heading: "6. Data Sharing",
          body: "We share data only with trusted processors required to provide the service (for example, payment, hosting, and communications providers). We do not sell personal data.",
        },
        {
          heading: "7. International Transfers",
          body: "If personal data is transferred outside the UK, we use approved safeguards such as adequacy regulations or standard contractual clauses with additional safeguards where appropriate.",
        },
        {
          heading: "8. Retention",
          body: "We retain data only as long as needed for service operation, dispute handling, fraud prevention, and legal compliance, then delete or anonymize it.",
        },
        {
          heading: "9. Your Rights",
          body: "Subject to legal limits, you can request access, rectification, erasure, restriction, objection, and portability, and withdraw consent where processing is based on consent.",
        },
        {
          heading: "10. Complaints and Contact",
          body: "For privacy requests, contact contact@dibblemarketplace.com. You can also complain to the UK Information Commissioner's Office (ICO) if you believe your data has been handled unlawfully.",
        },
      ],
    },
  };
}

export async function getLegalPagesContent(): Promise<LegalPagesContent> {
  const defaults = getDefaultLegalPagesContent();
  const stored = await readJsonFile<Partial<LegalPagesContent>>(legalPagesPath, defaults);

  return {
    about: {
      ...defaults.about,
      ...(stored.about ?? {}),
    },
    faq: {
      ...defaults.faq,
      ...(stored.faq ?? {}),
      items: stored.faq?.items ?? defaults.faq.items,
    },
    terms: {
      ...defaults.terms,
      ...(stored.terms ?? {}),
      sections: stored.terms?.sections ?? defaults.terms.sections,
    },
    privacy: {
      ...defaults.privacy,
      ...(stored.privacy ?? {}),
      sections: stored.privacy?.sections ?? defaults.privacy.sections,
    },
  };
}

export async function saveLegalPagesContent(content: LegalPagesContent) {
  await writeJsonFile(legalPagesPath, content);
}

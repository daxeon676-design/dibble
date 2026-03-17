import Link from "next/link";
import { getSiteConfig } from "@/lib/site-config";

export default async function Footer() {
  const config = await getSiteConfig();
  return (
    <footer className="mt-auto border-t border-(--accent-terra)/30 bg-(--accent-beige)">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 gap-8 sm:grid-cols-4">
        <div>
          <p className="mb-2 text-lg font-bold text-(--accent-terra)">Dibble</p>
          <p className="text-sm leading-relaxed text-foreground/80">{config.footerDescription}</p>
        </div>

        <div>
          <p className="mb-3 font-semibold text-(--accent-terra)">Marketplace</p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link href="/buyer/marketplace" className="hover:text-(--accent-terra)">
                Browse Products
              </Link>
            </li>
            <li>
              <Link href="/buyer/cart" className="hover:text-(--accent-terra)">
                Your Cart
              </Link>
            </li>
            <li>
              <Link href="/buyer/orders" className="hover:text-(--accent-terra)">
                Your Orders
              </Link>
            </li>
            <li>
              <Link href="/buyer/seller-application" className="hover:text-(--accent-terra)">
                Sell on Dibble
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 font-semibold text-(--accent-terra)">Company</p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <Link href="/about" className="hover:text-(--accent-terra)">
                About Us
              </Link>
            </li>
            <li>
              <Link href="/faq" className="hover:text-(--accent-terra)">
                FAQ
              </Link>
            </li>
            <li>
              <Link href="/terms" className="hover:text-(--accent-terra)">
                Terms &amp; Conditions
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="hover:text-(--accent-terra)">
                Privacy Policy
              </Link>
            </li>
            <li>
              <Link href="/cookies" className="hover:text-(--accent-terra)">
                Cookie Policy
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="mb-3 font-semibold text-(--accent-terra)">Get in Touch</p>
          <ul className="space-y-2 text-sm text-foreground/80">
            <li>
              <a href={`mailto:${config.supportEmail}`} className="hover:text-(--accent-terra)">
                {config.supportEmail}
              </a>
            </li>
            <li className="text-xs italic text-foreground/60">
              Mon – Fri, 9am – 5pm GMT
            </li>
          </ul>
        </div>
      </div>

      <div className="border-t">
        <p className="text-center text-xs text-gray-400 py-4">
          &copy; {new Date().getFullYear()} Dibble Ltd. All rights reserved.
        </p>
      </div>
    </footer>
  );
}

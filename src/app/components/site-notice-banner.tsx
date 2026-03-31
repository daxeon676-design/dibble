import Link from "next/link";

export function SiteNoticeBanner() {
  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
        <span className="font-semibold">Site notice:</span>
        <span>Dibble is currently in beta.</span>
        <span>Please send feedback, suggestions, and bug reports to</span>
        <Link href="mailto:contact@dibblemarketplace.com" className="font-semibold underline underline-offset-2">
          contact@dibblemarketplace.com
        </Link>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type FaqItem = { q: string; a: string };
type Section = { heading: string; body: string };

type LegalContent = {
  about: { title: string; subtitle: string; body: string; contactEmail: string };
  faq: { title: string; intro: string; contactEmail: string; items: FaqItem[] };
  terms: { title: string; lastUpdated: string; sections: Section[] };
  privacy: { title: string; lastUpdated: string; sections: Section[] };
};

export default function LegalPagesEditorClient() {
  const [content, setContent] = useState<LegalContent | null>(null);
  const [activeTab, setActiveTab] = useState<"about" | "faq" | "terms" | "privacy">("about");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/legal-pages")
      .then((r) => r.json())
      .then((data: LegalContent) => setContent(data));
  }, []);

  if (!content) {
    return <p>Loading legal page content...</p>;
  }

  function updateFaqItem(index: number, patch: Partial<FaqItem>) {
    setContent((prev) => {
      if (!prev) return prev;
      const items = [...prev.faq.items];
      items[index] = { ...items[index], ...patch };
      return { ...prev, faq: { ...prev.faq, items } };
    });
  }

  function updateSection(page: "terms" | "privacy", index: number, patch: Partial<Section>) {
    setContent((prev) => {
      if (!prev) return prev;
      const sections = [...prev[page].sections];
      sections[index] = { ...sections[index], ...patch };
      return { ...prev, [page]: { ...prev[page], sections } };
    });
  }

  async function save() {
    setSaving(true);
    setMessage(null);

    const response = await fetch("/api/admin/legal-pages", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(content),
    });

    setSaving(false);
    setMessage(response.ok ? "Saved successfully" : "Failed to save content");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {([
          ["about", "About"],
          ["faq", "FAQ"],
          ["terms", "Terms"],
          ["privacy", "Privacy"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={`rounded px-3 py-2 text-sm ${activeTab === key ? "bg-slate-900 text-white" : "border border-slate-300"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="rounded border border-slate-200 bg-white p-6">
        {activeTab === "about" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">About Page</h2>
            <label className="block text-sm">
              Title
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.about.title}
                onChange={(e) => setContent({ ...content, about: { ...content.about, title: e.target.value } })}
              />
            </label>
            <label className="block text-sm">
              Subtitle
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.about.subtitle}
                onChange={(e) => setContent({ ...content, about: { ...content.about, subtitle: e.target.value } })}
              />
            </label>
            <label className="block text-sm">
              Main body
              <textarea
                className="mt-1 min-h-56 w-full rounded border border-slate-300 px-3 py-2"
                value={content.about.body}
                onChange={(e) => setContent({ ...content, about: { ...content.about, body: e.target.value } })}
              />
            </label>
            <label className="block text-sm">
              Contact email
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.about.contactEmail}
                onChange={(e) => setContent({ ...content, about: { ...content.about, contactEmail: e.target.value } })}
              />
            </label>
          </section>
        ) : null}

        {activeTab === "faq" ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">FAQ Page</h2>
            <label className="block text-sm">
              Title
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.faq.title}
                onChange={(e) => setContent({ ...content, faq: { ...content.faq, title: e.target.value } })}
              />
            </label>
            <label className="block text-sm">
              Intro text
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.faq.intro}
                onChange={(e) => setContent({ ...content, faq: { ...content.faq, intro: e.target.value } })}
              />
            </label>
            <label className="block text-sm">
              Contact email
              <input
                type="email"
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content.faq.contactEmail}
                onChange={(e) => setContent({ ...content, faq: { ...content.faq, contactEmail: e.target.value } })}
              />
            </label>

            <div className="space-y-3 pt-1">
              {content.faq.items.map((item, index) => (
                <div key={`faq-${index}`} className="rounded border border-slate-200 p-3">
                  <label className="block text-sm">
                    Question
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={item.q}
                      onChange={(e) => updateFaqItem(index, { q: e.target.value })}
                    />
                  </label>
                  <label className="mt-2 block text-sm">
                    Answer
                    <textarea
                      className="mt-1 min-h-24 w-full rounded border border-slate-300 px-3 py-2"
                      value={item.a}
                      onChange={(e) => updateFaqItem(index, { a: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                    onClick={() =>
                      setContent((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          faq: {
                            ...prev.faq,
                            items: prev.faq.items.filter((_, i) => i !== index),
                          },
                        };
                      })
                    }
                  >
                    Remove question
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() =>
                  setContent({
                    ...content,
                    faq: {
                      ...content.faq,
                      items: [...content.faq.items, { q: "New question", a: "New answer" }],
                    },
                  })
                }
              >
                Add question
              </button>
            </div>
          </section>
        ) : null}

        {(activeTab === "terms" || activeTab === "privacy") ? (
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">{activeTab === "terms" ? "Terms" : "Privacy"} Page</h2>
            <label className="block text-sm">
              Title
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content[activeTab].title}
                onChange={(e) =>
                  setContent({
                    ...content,
                    [activeTab]: { ...content[activeTab], title: e.target.value },
                  })
                }
              />
            </label>
            <label className="block text-sm">
              Last updated text
              <input
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                value={content[activeTab].lastUpdated}
                onChange={(e) =>
                  setContent({
                    ...content,
                    [activeTab]: { ...content[activeTab], lastUpdated: e.target.value },
                  })
                }
              />
            </label>

            <div className="space-y-3 pt-1">
              {content[activeTab].sections.map((section, index) => (
                <div key={`${activeTab}-${index}`} className="rounded border border-slate-200 p-3">
                  <label className="block text-sm">
                    Section heading
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
                      value={section.heading}
                      onChange={(e) => updateSection(activeTab, index, { heading: e.target.value })}
                    />
                  </label>
                  <label className="mt-2 block text-sm">
                    Section body
                    <textarea
                      className="mt-1 min-h-24 w-full rounded border border-slate-300 px-3 py-2"
                      value={section.body}
                      onChange={(e) => updateSection(activeTab, index, { body: e.target.value })}
                    />
                  </label>
                  <button
                    type="button"
                    className="mt-2 rounded border border-red-300 px-2 py-1 text-xs text-red-700"
                    onClick={() =>
                      setContent((prev) => {
                        if (!prev) return prev;
                        return {
                          ...prev,
                          [activeTab]: {
                            ...prev[activeTab],
                            sections: prev[activeTab].sections.filter((_, i) => i !== index),
                          },
                        };
                      })
                    }
                  >
                    Remove section
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="rounded border border-slate-300 px-3 py-2 text-sm"
                onClick={() =>
                  setContent({
                    ...content,
                    [activeTab]: {
                      ...content[activeTab],
                      sections: [...content[activeTab].sections, { heading: "New section", body: "Section content" }],
                    },
                  })
                }
              >
                Add section
              </button>
            </div>
          </section>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Legal Content"}
        </button>
        {message ? <p className="text-sm text-slate-600">{message}</p> : null}
      </div>
    </div>
  );
}

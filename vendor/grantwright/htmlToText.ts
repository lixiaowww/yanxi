// Vendored from lixiaowww/grantwright src/lib/collect.ts (htmlToText only).
// Grant-domain catalog code intentionally NOT imported.
// Sibling checkout: /mnt/external_storage/File/grantwright

const UNSAFE_FOR_POSTGRES_JSON = new RegExp(
  "[" +
  Array.from({ length: 32 }, (_, i) => i)
    .filter((c) => c !== 9 && c !== 10 && c !== 13)
    .map((c) => String.fromCharCode(c))
    .join("") +
  String.fromCharCode(127) +
  "]",
  "g"
);
const LONE_SURROGATE = new RegExp(
  "[\\uD800-\\uDBFF](?![\\uDC00-\\uDFFF])|(?:^|[^\\uD800-\\uDBFF])[\\uDC00-\\uDFFF]",
  "g"
);

// Crude but dependency-free HTML → text. Good enough for change detection;
// a human verifies the live page before anything goes in the digest.
export function htmlToText(html: string): string {
  return html
    .replace(UNSAFE_FOR_POSTGRES_JSON, " ")
    .replace(LONE_SURROGATE, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#\d+;|&[a-z]+;/gi, " ")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 2)
    .join("\n");
}

import { GRE_QUANT_CATEGORIES } from "@/lib/validator/quant";
import { GRE_VERBAL_PRIMARY_TYPES } from "@/lib/validator/verbal";

const BASE_URL = process.env.CHECK_ENDPOINT || "http://localhost:3000/api/next-question";

async function checkOne(payload: Record<string, unknown>) {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.concept) {
    throw new Error(`Failed for ${JSON.stringify(payload)} -> ${res.status} ${json?.message || json?.error}`);
  }
  return json;
}

async function main() {
  const failures: string[] = [];
  for (const cat of GRE_QUANT_CATEGORIES) {
    try {
      const resp = await checkOne({ exam: "GRE", section: "Quant", mode: "topic", topic: cat });
      const concept = (resp.topic ?? resp.concept ?? "").toString();
      if (concept.toLowerCase() !== cat.toLowerCase()) {
        throw new Error(`Mismatched concept: expected ${cat}, got ${concept || "(blank)"}`);
      }
      console.log(`✔ Quant ${cat}`);
    } catch (err: any) {
      failures.push(`Quant ${cat}: ${err?.message || err}`);
    }
  }
  for (const cat of GRE_VERBAL_PRIMARY_TYPES) {
    try {
      const resp = await checkOne({ exam: "GRE", section: "Verbal", mode: "topic", topic: cat });
      const concept = (resp.topic ?? resp.concept ?? "").toString();
      if (concept.toLowerCase() !== cat.toLowerCase()) {
        throw new Error(`Mismatched concept: expected ${cat}, got ${concept || "(blank)"}`);
      }
      console.log(`✔ Verbal ${cat}`);
    } catch (err: any) {
      failures.push(`Verbal ${cat}: ${err?.message || err}`);
    }
  }
  if (failures.length) {
    console.error("Failures:\n" + failures.join("\n"));
    process.exit(1);
  }
  console.log("All concepts returned a question with matching topic.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

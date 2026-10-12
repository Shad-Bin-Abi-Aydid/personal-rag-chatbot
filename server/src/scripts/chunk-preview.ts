// Phase 1 check: print every chunk exactly as it will be embedded.
// Run with: npm run chunk
import { chunkMarkdown, MAX_CHUNK_TOKENS } from "../ingest/chunk.js";
import { loadDocuments } from "../ingest/documents.js";

const EMBEDDING_PRICE_PER_MILLION_TOKENS = 0.02; // USD, text-embedding-3-small

const documents = await loadDocuments();
const chunks = documents.flatMap((doc) => chunkMarkdown(doc.markdown, doc.source));

for (const chunk of chunks) {
  const warning = chunk.tokenCount > MAX_CHUNK_TOKENS ? "  ⚠ over limit" : "";
  console.log(`\n━━ ${chunk.id}  (${chunk.tokenCount} tokens)${warning}`);
  console.log(`   source: ${chunk.source}  |  heading: ${chunk.heading}`);
  console.log(chunk.text.replace(/^/gm, "   │ "));
}

const tokenCounts = chunks.map((chunk) => chunk.tokenCount);
const totalTokens = tokenCounts.reduce((sum, count) => sum + count, 0);

console.log("\n━━ Summary");
console.table({
  documents: documents.length,
  chunks: chunks.length,
  "total tokens": totalTokens,
  "smallest chunk": Math.min(...tokenCounts),
  "average chunk": Math.round(totalTokens / chunks.length),
  "largest chunk": Math.max(...tokenCounts),
  "embedding cost (USD)": ((totalTokens / 1_000_000) * EMBEDDING_PRICE_PER_MILLION_TOKENS).toFixed(6),
});

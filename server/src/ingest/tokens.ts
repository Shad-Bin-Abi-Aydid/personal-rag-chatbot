import { getEncoding } from "js-tiktoken";

// cl100k_base is the tokenizer used by OpenAI's text-embedding-3 models,
// so these counts match what the embeddings API will see (and bill).
const encoding = getEncoding("cl100k_base");

export function countTokens(text: string): number {
  return encoding.encode(text).length;
}

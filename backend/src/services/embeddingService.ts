import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimension: number;
}

/**
 * Embedding Service for Semantic Search
 * Generates vector embeddings using Google Gemini's text-embedding-004 model
 */
class EmbeddingService {
  private model = "text-embedding-004"; // 768 dimensions, free tier available
  private expectedDimension = 768;

  /**
   * Generate embedding for email content (subject + body)
   * @param subject Email subject
   * @param body Email body (can be truncated for performance)
   * @returns Vector embedding (768 dimensions)
   */
  async generateEmailEmbedding(
    subject: string,
    body: string
  ): Promise<number[]> {
    try {
      // Combine subject and body with weight on subject
      // Truncate body to 8000 characters to stay within token limits
      const text = `Subject: ${subject}\n\n${body.substring(0, 8000)}`;

      const model = genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent(text);

      return result.embedding.values;
    } catch (error) {
      console.error("Error generating embedding:", error);
      throw new Error("Failed to generate email embedding");
    }
  }

  /**
   * Generate embeddings for multiple emails in batch (more efficient)
   * @param emails Array of email objects with subject and body
   * @returns Array of vector embeddings with metadata
   */
  async generateEmailEmbeddings(
    emails: Array<{ subject: string; body: string }>
  ): Promise<EmbeddingResult[]> {
    try {
      if (emails.length === 0) {
        return [];
      }

      // Prepare texts for batch embedding
      const texts = emails.map(
        (email) =>
          `Subject: ${email.subject}\n\n${email.body.substring(0, 8000)}`
      );

      const model = genAI.getGenerativeModel({ model: this.model });

      // Batch embed all emails at once
      const result = await model.batchEmbedContents({
        requests: texts.map((text) => ({
          content: { parts: [{ text }], role: "user" },
        })),
      });

      // Extract embeddings and return with metadata
      return result.embeddings.map((embeddingData) => ({
        embedding: embeddingData.values,
        model: this.model,
        dimension: embeddingData.values.length,
      }));
    } catch (error) {
      console.error("Error generating batch embeddings:", error);
      throw new Error("Failed to generate batch embeddings");
    }
  }

  /**
   * Generate embedding for a search query
   * @param query User's search query
   * @returns Vector embedding (768 dimensions)
   */
  async generateQueryEmbedding(query: string): Promise<number[]> {
    try {
      const model = genAI.getGenerativeModel({ model: this.model });
      const result = await model.embedContent(query);

      return result.embedding.values;
    } catch (error) {
      console.error("Error generating query embedding:", error);
      throw new Error("Failed to generate query embedding");
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   * Handles edge cases: zero-norm vectors, mismatched dimensions
   * @param vecA First vector
   * @param vecB Second vector
   * @returns Similarity score between -1 and 1 (higher is more similar), or 0 if invalid
   */
  cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      console.warn(
        `Vector dimension mismatch: ${vecA.length} vs ${vecB.length}`
      );
      throw new Error("Vectors must have same length");
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      const a = vecA[i];
      const b = vecB[i];
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    // Handle zero-norm vectors (prevents NaN from division by zero)
    if (!normA || !normB) {
      console.warn("Zero-norm vector detected in cosine similarity");
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get the model name used for embeddings
   */
  getModel(): string {
    return this.model;
  }

  /**
   * Get the expected dimension of embeddings
   */
  getExpectedDimension(): number {
    return this.expectedDimension;
  }
}

export default new EmbeddingService();

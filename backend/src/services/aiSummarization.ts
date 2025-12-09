import axios from "axios";

class AISummarizationService {
  private apiKey: string;
  private apiUrl: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || "";
    this.apiUrl =
      "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";
  }

  /**
   * Generate a summary of email content using Google Gemini AI
   * @param emailBody The full email body text
   * @param subject The email subject
   * @returns A concise summary of the email
   */
  async generateSummary(emailBody: string, subject: string): Promise<string> {
    try {
      if (!this.apiKey) {
        console.warn("Gemini API key not configured, returning preview");
        return this.generateSimpleSummary(emailBody);
      }

      // Check if email body is empty or just HTML tags
      const cleanBody = emailBody.replace(/<[^>]*>/g, "").trim();
      if (!cleanBody || cleanBody.length < 10) {
        return `Email about: ${subject}. No content body available.`;
      }

      const prompt = `You are an AI assistant that summarizes emails concisely. Provide a brief 2-3 sentence summary that captures the key points and action items.

Subject: ${subject}

Email Body:
${emailBody}

Please provide a concise summary of this email.`;

      const response = await axios.post(
        `${this.apiUrl}?key=${this.apiKey}`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 150,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const summary =
        response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
        this.generateSimpleSummary(emailBody);
      return summary;
    } catch (error: any) {
      console.error("Gemini AI Summarization error:", {
        message: error?.message,
        status: error?.response?.status,
        statusText: error?.response?.statusText,
        data: error?.response?.data,
      });
      return this.generateSimpleSummary(emailBody);
    }
  }

  /**
   * Generate a simple summary by extracting first few sentences
   * Used as fallback when API is unavailable
   */
  private generateSimpleSummary(emailBody: string): string {
    // Remove HTML tags if present
    const cleanText = emailBody.replace(/<[^>]*>/g, "").trim();

    // Handle empty content
    if (!cleanText || cleanText.length < 10) {
      return "No content available to summarize.";
    }

    // Get first 200 characters
    const preview = cleanText.substring(0, 200).trim();

    // Try to cut at sentence boundary
    const lastPeriod = preview.lastIndexOf(".");
    if (lastPeriod > 100) {
      return preview.substring(0, lastPeriod + 1);
    }

    return preview + (cleanText.length > 200 ? "..." : "");
  }

  /**
   * Batch summarize multiple emails
   * @param emails Array of email objects with body and subject
   * @returns Array of summaries in the same order
   */
  async batchSummarize(
    emails: Array<{ body: string; subject: string }>
  ): Promise<string[]> {
    const summaries = await Promise.all(
      emails.map((email) => this.generateSummary(email.body, email.subject))
    );
    return summaries;
  }
}

export default new AISummarizationService();

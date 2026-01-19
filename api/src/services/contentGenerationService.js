const OpenAI = require('openai');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// HTML sanitization
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const ALLOWED_TAGS = ['h1', 'h2', 'h3', 'h4', 'p', 'blockquote', 'ul', 'ol', 'li', 'strong', 'em', 'a', 'br'];
const ALLOWED_ATTR = ['href', 'title'];

class ContentGenerationService {
  /**
   * Build the system message for OpenAI
   * @returns {string} System message
   */
  buildSystemMessage() {
    return `You are a professional writing assistant generating content from provided news inputs.

CRITICAL RULES:
- Do not invent facts or fabricate information
- If uncertain about any details, clearly label uncertainty with phrases like "reportedly", "allegedly", "according to sources"
- Do not claim to have verified sources or tweets
- Do not make defamatory statements
- Avoid naming private individuals unless explicitly provided in the source
- For security/intelligence briefing audiences: provide high-level risk framing, avoid operational details

OUTPUT FORMAT:
- Return ONLY valid HTML markup (no markdown)
- Use semantic HTML structure
- Required tags: <h1> for title, <p> for paragraphs, <h2> for section headings
- Optional tags: <blockquote> for quotes, <ul><li> for lists, <strong> for emphasis
- If citations are needed but not provided, use placeholder text like "[SOURCE NEEDED]"
- Do NOT include any explanatory text outside of HTML tags`;
  }

  /**
   * Build the user prompt from generation inputs
   * @param {Object} params
   * @param {string} params.sourceType - TWEET, HEADLINE, URL, FREE_TEXT
   * @param {string} params.sourceText - The actual source content
   * @param {string} [params.sourceUrl] - Optional URL
   * @param {Object} params.generationInputs - All generation controls
   * @returns {string} User prompt
   */
  buildUserPrompt({ sourceType, sourceText, sourceUrl, generationInputs }) {
    const {
      persona = {},
      tone = 'neutral',
      style = 'AP_style',
      audience = 'general',
      format = {},
      constraints = {}
    } = generationInputs;

    let prompt = `Generate professional content based on the following news input:\n\n`;

    // Source
    prompt += `SOURCE TYPE: ${sourceType}\n`;
    prompt += `SOURCE CONTENT:\n${sourceText}\n\n`;
    if (sourceUrl) {
      prompt += `SOURCE URL: ${sourceUrl}\n\n`;
    }

    // Persona
    if (persona.name) {
      prompt += `PERSONA: ${persona.name}\n`;
      if (persona.details) {
        prompt += `Persona details: ${persona.details}\n`;
      }
      prompt += `\n`;
    }

    // Tone
    prompt += `TONE: ${tone}\n`;
    if (tone === 'urgent') {
      prompt += `Use urgent, immediate language while remaining factual.\n`;
    } else if (tone === 'diplomatic') {
      prompt += `Use careful, measured language. Avoid controversial statements.\n`;
    } else if (tone === 'empathetic') {
      prompt += `Use compassionate language that acknowledges human impact.\n`;
    }
    prompt += `\n`;

    // Style
    prompt += `WRITING STYLE: ${style}\n`;
    if (style === 'AP_style') {
      prompt += `Follow AP Stylebook guidelines: active voice, short sentences, inverted pyramid structure.\n`;
    } else if (style === 'Reuters') {
      prompt += `Follow Reuters style: neutral tone, fact-first, attribution-heavy.\n`;
    } else if (style === 'Policy_memo') {
      prompt += `Use policy memo format: executive summary, background, recommendations.\n`;
    }
    prompt += `\n`;

    // Audience
    prompt += `TARGET AUDIENCE: ${audience}\n`;
    if (audience === 'journalists') {
      prompt += `Write for media professionals. Include context and background they need for further reporting.\n`;
    } else if (audience === 'security_briefing') {
      prompt += `Write for security/intelligence audience. Focus on risk assessment and situational awareness. Avoid operational details.\n`;
    } else if (audience === 'general') {
      prompt += `Write for general public. Explain context and avoid jargon.\n`;
    }
    prompt += `\n`;

    // Format
    if (format.length) {
      prompt += `LENGTH: ${format.length}\n`;
      if (format.length === 'short') {
        prompt += `Target 200-400 words.\n`;
      } else if (format.length === 'medium') {
        prompt += `Target 600-900 words.\n`;
      } else if (format.length === 'long') {
        prompt += `Target 1200-1800 words.\n`;
      }
      prompt += `\n`;
    }

    if (format.template) {
      prompt += `STRUCTURE TEMPLATE: ${format.template}\n`;
      if (format.template === 'Article') {
        prompt += `Structure: Headline (<h1>), Lede paragraph, Body paragraphs, Background section (<h2>Background</h2>), Quote blocks if applicable (<blockquote>).\n`;
      } else if (format.template === 'Press_release') {
        prompt += `Structure: "FOR IMMEDIATE RELEASE" header, Dateline, Headline (<h1>), Opening paragraph, Body, Boilerplate section.\n`;
      } else if (format.template === 'Press_briefing') {
        prompt += `Structure: Key Messages (<h2>), Q&A section (<h2>Q&A</h2>), Talking Points (<ul><li>).\n`;
      }
      prompt += `\n`;
    }

    // Include sections
    if (format.includeSections) {
      prompt += `INCLUDE SECTIONS:\n`;
      if (format.includeSections.background) {
        prompt += `- Include a background/context section\n`;
      }
      if (format.includeSections.whatWeKnow) {
        prompt += `- Include "What we know / What we don't know" section\n`;
      }
      if (format.includeSections.risks) {
        prompt += `- Include risks/uncertainty disclaimer\n`;
      }
      if (format.includeSections.callToAction) {
        prompt += `- Include call-to-action\n`;
      }
      prompt += `\n`;
    }

    // Citations
    if (format.citations && format.citations !== 'none') {
      prompt += `CITATIONS: ${format.citations}\n`;
      if (format.citations === 'placeholders') {
        prompt += `Use [SOURCE NEEDED] placeholders where citations would go. Do not invent sources.\n`;
      } else if (format.citations === 'explicit') {
        prompt += `Add "Source:" lines after claims, but only if the source is provided. Otherwise use [SOURCE NEEDED].\n`;
      }
      prompt += `\n`;
    }

    // Constraints
    if (constraints.mustInclude && constraints.mustInclude.length > 0) {
      prompt += `MUST INCLUDE:\n`;
      constraints.mustInclude.forEach(item => {
        prompt += `- ${item}\n`;
      });
      prompt += `\n`;
    }

    if (constraints.mustAvoid && constraints.mustAvoid.length > 0) {
      prompt += `MUST AVOID:\n`;
      constraints.mustAvoid.forEach(item => {
        prompt += `- ${item}\n`;
      });
      prompt += `\n`;
    }

    if (constraints.bannedPhrases && constraints.bannedPhrases.length > 0) {
      prompt += `BANNED PHRASES (do not use):\n`;
      constraints.bannedPhrases.forEach(phrase => {
        prompt += `- "${phrase}"\n`;
      });
      prompt += `\n`;
    }

    // Legal/Safety disclaimers
    if (constraints.legalSafety) {
      prompt += `LEGAL/SAFETY REQUIREMENTS:\n`;
      if (constraints.legalSafety.noDefamation) {
        prompt += `- No defamation or accusations without evidence\n`;
      }
      if (constraints.legalSafety.noPersonalData) {
        prompt += `- No personal data or private information\n`;
      }
      if (constraints.legalSafety.noOperationalDetails) {
        prompt += `- No operational or security-sensitive details\n`;
      }
      prompt += `\n`;
    }

    prompt += `OUTPUT:\nGenerate the content now as valid HTML only. Do not include any explanatory text or comments outside the HTML.`;

    return prompt;
  }

  /**
   * Sanitize HTML output from LLM
   * @param {string} html - Raw HTML from LLM
   * @returns {string} Sanitized HTML
   */
  sanitizeHtml(html) {
    const clean = DOMPurify.sanitize(html, {
      ALLOWED_TAGS,
      ALLOWED_ATTR,
      ALLOW_DATA_ATTR: false,
    });

    // Enforce max length (40k chars)
    if (clean.length > 40000) {
      return clean.substring(0, 40000) + '\n<p><em>[Content truncated at 40,000 characters]</em></p>';
    }

    return clean;
  }

  /**
   * Generate content using OpenAI
   * @param {Object} params
   * @param {string} params.sourceType
   * @param {string} params.sourceText
   * @param {string} [params.sourceUrl]
   * @param {Object} params.generationInputs
   * @param {string} [params.model='gpt-4-turbo-preview']
   * @param {number} [params.temperature=0.6]
   * @returns {Promise<{htmlContent: string, metadata: Object}>}
   */
  async generateContent({
    sourceType,
    sourceText,
    sourceUrl,
    generationInputs,
    model = 'gpt-4-turbo-preview',
    temperature = 0.6,
  }) {
    const systemMessage = this.buildSystemMessage();
    const userPrompt = this.buildUserPrompt({
      sourceType,
      sourceText,
      sourceUrl,
      generationInputs,
    });

    try {
      const startTime = Date.now();

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 4000,
      });

      const duration = Date.now() - startTime;
      const rawHtml = response.choices[0].message.content;
      const sanitizedHtml = this.sanitizeHtml(rawHtml);

      const metadata = {
        model: response.model,
        temperature,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        requestId: response.id,
        duration,
        finishReason: response.choices[0].finish_reason,
      };

      return {
        htmlContent: sanitizedHtml,
        metadata,
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);

      // Check for specific error types
      if (error.code === 'insufficient_quota') {
        throw new Error('OpenAI API quota exceeded. Please check your API key and billing.');
      } else if (error.code === 'invalid_api_key') {
        throw new Error('Invalid OpenAI API key.');
      } else if (error.status === 429) {
        throw new Error('Rate limit exceeded. Please try again in a moment.');
      }

      throw new Error(`Content generation failed: ${error.message}`);
    }
  }

  /**
   * Revise existing content
   * @param {Object} params
   * @param {string} params.currentHtml - Current HTML content
   * @param {string} params.sourceType
   * @param {string} params.sourceText
   * @param {string} [params.sourceUrl]
   * @param {Object} params.generationInputs
   * @param {string} [params.revisionInstructions] - Specific revision instructions
   * @param {string} [params.model='gpt-4-turbo-preview']
   * @param {number} [params.temperature=0.6]
   * @returns {Promise<{htmlContent: string, metadata: Object}>}
   */
  async reviseContent({
    currentHtml,
    sourceType,
    sourceText,
    sourceUrl,
    generationInputs,
    revisionInstructions,
    model = 'gpt-4-turbo-preview',
    temperature = 0.6,
  }) {
    const systemMessage = this.buildSystemMessage();
    let userPrompt = this.buildUserPrompt({
      sourceType,
      sourceText,
      sourceUrl,
      generationInputs,
    });

    userPrompt += `\n\nCURRENT VERSION:\n${currentHtml}\n\n`;

    if (revisionInstructions) {
      userPrompt += `REVISION INSTRUCTIONS:\n${revisionInstructions}\n\n`;
      userPrompt += `Revise the current version according to the instructions while maintaining the structure and applying all the generation controls above.\n\n`;
    } else {
      userPrompt += `Revise and improve the current version while applying all the generation controls above.\n\n`;
    }

    userPrompt += `OUTPUT:\nGenerate the revised content as valid HTML only.`;

    try {
      const startTime = Date.now();

      const response = await openai.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: 4000,
      });

      const duration = Date.now() - startTime;
      const rawHtml = response.choices[0].message.content;
      const sanitizedHtml = this.sanitizeHtml(rawHtml);

      const metadata = {
        model: response.model,
        temperature,
        promptTokens: response.usage?.prompt_tokens,
        completionTokens: response.usage?.completion_tokens,
        totalTokens: response.usage?.total_tokens,
        requestId: response.id,
        duration,
        finishReason: response.choices[0].finish_reason,
        isRevision: true,
      };

      return {
        htmlContent: sanitizedHtml,
        metadata,
      };
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error(`Content revision failed: ${error.message}`);
    }
  }
}

module.exports = new ContentGenerationService();

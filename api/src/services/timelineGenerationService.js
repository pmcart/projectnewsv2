const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class TimelineGenerationService {
  buildSystemMessage() {
    return `You are an expert intelligence analyst and investigative journalist specializing in constructing chronological timelines of events related to breaking news stories.

Your task is to analyze a breaking news item and construct a detailed timeline of notable events, signals, patterns, and incidents that are relevant to understanding the full context and evolution of the story.

CRITICAL RULES:
- Base your timeline on well-known, verifiable events and publicly reported information
- Do not fabricate events or dates. If a date is approximate, indicate that clearly (e.g., "Early March 2024", "Late 2023")
- If you are uncertain about an event, use language like "reportedly", "allegedly", "according to reports"
- Include events that PRECEDED the breaking news (background/buildup), the event itself, and any known follow-on developments
- Focus on events that are genuinely relevant and help explain the significance of the news
- Aim for 8-12 events for a well-contextualized timeline
- Order events chronologically from earliest to most recent
- Keep descriptions concise: 2-4 sentences per event

EVENT CATEGORIES:
- "incident" - A specific event, attack, accident, or occurrence
- "signal" - An early warning sign, intelligence indicator, or precursor
- "pattern" - A recurring trend or behavior pattern that provides context
- "response" - Official responses, statements, policy actions, or countermeasures
- "escalation" - Events that represent an escalation or intensification
- "context" - Background information, historical context, or structural factors

SIGNIFICANCE SCALE (1-5):
- 1: Minor/tangential context
- 2: Relevant background
- 3: Moderately significant to understanding the story
- 4: Highly significant event
- 5: Critical/pivotal event directly tied to the breaking news

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "events": [
    {
      "date": "Date string (ISO format preferred, or descriptive like 'Early March 2024')",
      "title": "Short event title (max 80 characters)",
      "description": "Concise description of the event (2-4 sentences). Include what happened and why it matters.",
      "category": "incident|signal|pattern|response|escalation|context",
      "significance": 3,
      "sources": [
        {"title": "Source name/description", "url": "URL if known, otherwise omit"}
      ]
    }
  ]
}`;
  }

  buildUserPrompt({ sourceText, sourceAccount }) {
    let prompt = `Construct a comprehensive timeline for the following breaking news story:\n\n`;

    if (sourceAccount) {
      prompt += `BREAKING NEWS SOURCE: ${sourceAccount}\n\n`;
    }

    prompt += `BREAKING NEWS TEXT:\n${sourceText}\n\n`;

    prompt += `INSTRUCTIONS:\n`;
    prompt += `1. Identify the core topic/event in this breaking news\n`;
    prompt += `2. Construct a timeline of 8-12 events that provide full context\n`;
    prompt += `3. Include events from before, during, and after (if applicable) the breaking news\n`;
    prompt += `4. Categorize each event (incident, signal, pattern, response, escalation, context)\n`;
    prompt += `5. Rate significance (1-5), order chronologically\n`;
    prompt += `6. Keep descriptions concise (2-4 sentences each)\n\n`;

    prompt += `Generate the timeline now in JSON format:`;

    return prompt;
  }

  async generateTimeline({ sourceText, sourceAccount }) {
    const systemMessage = this.buildSystemMessage();
    const userPrompt = this.buildUserPrompt({ sourceText, sourceAccount });

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content);

      const llmMetadata = {
        model: completion.model,
        promptTokens: completion.usage.prompt_tokens,
        completionTokens: completion.usage.completion_tokens,
        totalTokens: completion.usage.total_tokens,
        requestId: completion.id,
        finishReason: completion.choices[0].finish_reason,
        generatedAt: new Date().toISOString()
      };

      return {
        events: result.events,
        llmMetadata
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate timeline: ${error.message}`);
    }
  }

  validateTimelineResponse(events) {
    if (!events || !Array.isArray(events) || events.length === 0) {
      return false;
    }

    const validCategories = ['incident', 'signal', 'pattern', 'response', 'escalation', 'context'];

    for (const event of events) {
      if (!event.date || !event.title || !event.description || !event.category) {
        return false;
      }
      if (!validCategories.includes(event.category.toLowerCase())) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new TimelineGenerationService();

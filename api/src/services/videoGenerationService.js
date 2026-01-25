const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class VideoGenerationService {
  /**
   * Build the system message for OpenAI video generation
   * @returns {string} System message
   */
  buildSystemMessage() {
    return `You are a professional video production assistant that creates detailed video plans for news content.

Your task is to analyze news content and generate a comprehensive video production plan that can be executed using ffmpeg and image generation tools.

CRITICAL RULES:
- Do not invent facts or fabricate information
- Base all narration and visuals on the provided source material
- If uncertain about details, use phrases like "reportedly", "allegedly"
- Do not make defamatory statements
- Avoid naming private individuals unless explicitly provided in the source

OUTPUT FORMAT:
Return a JSON object with the following structure:
{
  "title": "Video title",
  "description": "Brief description of the video",
  "scenes": [
    {
      "sceneNumber": 1,
      "duration": 5,
      "imagePrompt": "Detailed DALL-E prompt for generating the scene image",
      "narration": "Text to be spoken/displayed for this scene",
      "textOverlay": "Optional on-screen text",
      "transition": "fade|slide|cut",
      "effects": {
        "zoom": "in|out|none",
        "pan": "left|right|none",
        "kenBurns": true|false
      }
    }
  ],
  "audioNotes": "Description of background music mood and voice characteristics",
  "totalDuration": 30
}

SCENE GUIDELINES:
- CRITICAL: The sum of all scene durations MUST equal the target duration specified
- Each scene should be 3-8 seconds long
- For shorter videos (15-30 seconds): use 3-5 scenes
- For medium videos (60 seconds): use 6-10 scenes
- For longer videos (90-180 seconds): use 10-20 scenes
- imagePrompt should be detailed enough for DALL-E to generate relevant news imagery
- narration length MUST match the scene duration (roughly 2-3 words per second)
- A 5-second scene needs ~10-15 words of narration
- A 10-second scene needs ~20-30 words of narration
- Use transitions appropriately (fade for smooth, cut for urgency)
- Apply effects sparingly to maintain professionalism`;
  }

  /**
   * Build the user prompt for video generation
   * @param {Object} params
   * @param {string} params.sourceType - TWEET, HEADLINE, URL, FREE_TEXT
   * @param {string} params.sourceText - The actual source content
   * @param {string} [params.sourceUrl] - Optional URL
   * @param {Object} params.generationInputs - All generation controls
   * @returns {string} User prompt
   */
  buildUserPrompt({ sourceType, sourceText, sourceUrl, generationInputs }) {
    const {
      tone = 'professional',
      style = 'news_report',
      duration = '30',
      aspectRatio = '16:9',
      voice = 'neutral_male',
      musicStyle = 'none',
      includeSubtitles = true,
      includeLogo = false,
      template = 'breaking_news'
    } = generationInputs;

    let prompt = `Generate a detailed video production plan for the following news content:\n\n`;

    // Source
    prompt += `SOURCE TYPE: ${sourceType}\n`;
    prompt += `SOURCE CONTENT:\n${sourceText}\n\n`;
    if (sourceUrl) {
      prompt += `SOURCE URL: ${sourceUrl}\n\n`;
    }

    // Video specifications
    prompt += `VIDEO SPECIFICATIONS:\n`;
    prompt += `- Target Duration: ${duration} seconds\n`;
    prompt += `- Aspect Ratio: ${aspectRatio}\n`;
    prompt += `- Style: ${style}\n`;
    prompt += `- Tone: ${tone}\n`;
    prompt += `- Template: ${template}\n`;
    prompt += `- Voice: ${voice === 'none' ? 'Text-only (no narration)' : voice}\n`;
    prompt += `- Music: ${musicStyle}\n`;
    prompt += `- Subtitles: ${includeSubtitles ? 'Yes' : 'No'}\n`;
    prompt += `- Logo: ${includeLogo ? 'Yes' : 'No'}\n\n`;

    // Style guidance
    prompt += `STYLE GUIDANCE:\n`;
    if (style === 'news_report') {
      prompt += `- Create professional news broadcast style imagery\n`;
      prompt += `- Use clean, professional visuals\n`;
      prompt += `- Follow traditional news reporting structure\n`;
    } else if (style === 'documentary') {
      prompt += `- Use more cinematic and atmospheric imagery\n`;
      prompt += `- Create deeper, more contextual scenes\n`;
      prompt += `- Allow for longer scene durations\n`;
    } else if (style === 'social_media') {
      prompt += `- Create punchy, attention-grabbing visuals\n`;
      prompt += `- Use dynamic transitions and effects\n`;
      prompt += `- Keep scenes short and engaging\n`;
    }
    prompt += `\n`;

    // Tone guidance
    prompt += `TONE GUIDANCE:\n`;
    if (tone === 'urgent') {
      prompt += `- Use immediate, breaking news language\n`;
      prompt += `- Suggest quick cuts and dynamic effects\n`;
      prompt += `- Create sense of immediacy in imagery\n`;
    } else if (tone === 'calm') {
      prompt += `- Use measured, reassuring language\n`;
      prompt += `- Suggest smooth fades and gentle pans\n`;
      prompt += `- Create stable, calming imagery\n`;
    } else if (tone === 'dramatic') {
      prompt += `- Use powerful, impactful language\n`;
      prompt += `- Suggest dramatic zoom and Ken Burns effects\n`;
      prompt += `- Create striking, memorable imagery\n`;
    }
    prompt += `\n`;

    prompt += `IMPORTANT REMINDERS:\n`;
    prompt += `- The total of all scene durations MUST add up to exactly ${duration} seconds\n`;
    prompt += `- Each narration text length must match the scene duration (2-3 words per second)\n`;
    prompt += `- Calculate: for a ${duration}-second video, you need scenes that sum to ${duration} seconds total\n\n`;

    prompt += `Generate the video plan now in JSON format:`;

    return prompt;
  }

  /**
   * Generate video plan using OpenAI
   * @param {Object} params - Generation parameters
   * @returns {Promise<Object>} Generated video plan and metadata
   */
  async generateVideoPlan(params) {
    const { sourceType, sourceText, sourceUrl, generationInputs } = params;

    const systemMessage = this.buildSystemMessage();
    const userPrompt = this.buildUserPrompt({
      sourceType,
      sourceText,
      sourceUrl,
      generationInputs
    });

    try {
      const completion = await openai.chat.completions.create({
        model: generationInputs.model || 'gpt-4o',
        messages: [
          { role: 'system', content: systemMessage },
          { role: 'user', content: userPrompt }
        ],
        temperature: generationInputs.temperature || 0.7,
        response_format: { type: 'json_object' }
      });

      const videoPlan = JSON.parse(completion.choices[0].message.content);

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
        videoPlan,
        llmMetadata
      };
    } catch (error) {
      console.error('OpenAI API error:', error);
      throw new Error(`Failed to generate video plan: ${error.message}`);
    }
  }

  /**
   * Validate video plan structure
   * @param {Object} videoPlan
   * @returns {boolean}
   */
  validateVideoPlan(videoPlan) {
    if (!videoPlan || typeof videoPlan !== 'object') {
      return false;
    }

    if (!videoPlan.title || !videoPlan.scenes || !Array.isArray(videoPlan.scenes)) {
      return false;
    }

    for (const scene of videoPlan.scenes) {
      if (!scene.sceneNumber || !scene.duration || !scene.imagePrompt) {
        return false;
      }
    }

    return true;
  }
}

module.exports = new VideoGenerationService();

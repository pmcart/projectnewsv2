import { Component, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface VideoGenerationInputs {
  tone: string;
  style: string;
  duration: string;
  aspectRatio: string;
  voice: string;
  musicStyle: string;
  includeSubtitles: boolean;
  includeLogo: boolean;
  template: string;
}

export interface VideoGenerationRequest {
  sourceText: string;
  sourceUrl?: string;
  generationInputs: VideoGenerationInputs;
}

@Component({
  selector: 'app-video-generation-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './video-generation-controls.html',
  styleUrls: ['./video-generation-controls.css']
})
export class VideoGenerationControlsComponent {
  // Inputs
  sourceText = input.required<string>();
  sourceUrl = input<string>();
  disabled = input(false);

  // Outputs
  generate = output<VideoGenerationRequest>();

  // Form state
  tone = signal('professional');
  style = signal('news_report');
  duration = signal('30');
  aspectRatio = signal('16:9');
  voice = signal('neutral_male');
  musicStyle = signal('none');
  includeSubtitles = signal(true);
  includeLogo = signal(false);
  template = signal('breaking_news');

  // Loading state
  generating = signal(false);

  // Options for dropdowns
  toneOptions = [
    { value: 'professional', label: 'Professional' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'calm', label: 'Calm' },
    { value: 'dramatic', label: 'Dramatic' },
    { value: 'conversational', label: 'Conversational' },
    { value: 'authoritative', label: 'Authoritative' }
  ];

  styleOptions = [
    { value: 'news_report', label: 'News Report' },
    { value: 'documentary', label: 'Documentary' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'explainer', label: 'Explainer' },
    { value: 'interview', label: 'Interview' },
    { value: 'announcement', label: 'Announcement' }
  ];

  durationOptions = [
    { value: '15', label: '15 seconds' },
    { value: '30', label: '30 seconds' },
    { value: '60', label: '1 minute' },
    { value: '90', label: '1.5 minutes' },
    { value: '120', label: '2 minutes' },
    { value: '180', label: '3 minutes' }
  ];

  aspectRatioOptions = [
    { value: '16:9', label: '16:9 (Landscape)' },
    { value: '9:16', label: '9:16 (Portrait/Stories)' },
    { value: '1:1', label: '1:1 (Square)' },
    { value: '4:3', label: '4:3 (Standard)' }
  ];

  voiceOptions = [
    { value: 'neutral_male', label: 'Neutral Male' },
    { value: 'neutral_female', label: 'Neutral Female' },
    { value: 'authoritative_male', label: 'Authoritative Male' },
    { value: 'authoritative_female', label: 'Authoritative Female' },
    { value: 'friendly_male', label: 'Friendly Male' },
    { value: 'friendly_female', label: 'Friendly Female' },
    { value: 'none', label: 'No Voice (Text Only)' }
  ];

  musicStyleOptions = [
    { value: 'none', label: 'No Music' },
    { value: 'news_theme', label: 'News Theme' },
    { value: 'dramatic', label: 'Dramatic' },
    { value: 'uplifting', label: 'Uplifting' },
    { value: 'corporate', label: 'Corporate' },
    { value: 'ambient', label: 'Ambient' }
  ];

  templateOptions = [
    { value: 'breaking_news', label: 'Breaking News' },
    { value: 'headline_ticker', label: 'Headline Ticker' },
    { value: 'anchor_desk', label: 'Anchor Desk' },
    { value: 'minimal', label: 'Minimal' },
    { value: 'split_screen', label: 'Split Screen' },
    { value: 'full_screen_text', label: 'Full Screen Text' }
  ];

  onGenerate() {
    if (this.generating() || this.disabled()) {
      return;
    }

    this.generating.set(true);

    const generationInputs: VideoGenerationInputs = {
      tone: this.tone(),
      style: this.style(),
      duration: this.duration(),
      aspectRatio: this.aspectRatio(),
      voice: this.voice(),
      musicStyle: this.musicStyle(),
      includeSubtitles: this.includeSubtitles(),
      includeLogo: this.includeLogo(),
      template: this.template()
    };

    const request: VideoGenerationRequest = {
      sourceText: this.sourceText(),
      sourceUrl: this.sourceUrl(),
      generationInputs
    };

    this.generate.emit(request);

    // Reset generating state after a delay (parent will handle actual completion)
    setTimeout(() => {
      this.generating.set(false);
    }, 1000);
  }
}

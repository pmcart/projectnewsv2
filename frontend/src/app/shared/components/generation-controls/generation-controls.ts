import { Component, input, output, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { GenerationInputs } from '../../../services/content-generation.service';

export interface GenerationRequest {
  sourceType: string;
  sourceText: string;
  sourceUrl?: string;
  generationInputs: GenerationInputs;
  mode: 'new' | 'revise_current';
}

@Component({
  selector: 'app-generation-controls',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './generation-controls.html',
  styleUrls: ['./generation-controls.css']
})
export class GenerationControlsComponent implements OnInit {
  // Inputs
  sourceText = input.required<string>();
  sourceType = input.required<string>();
  sourceUrl = input<string>();
  disabled = input(false);

  // Outputs
  generate = output<GenerationRequest>();

  // Form state
  personaName = signal('Journalist');
  personaDetails = signal('');
  tone = signal('neutral');
  style = signal('AP_style');
  audience = signal('general');
  length = signal<'short' | 'medium' | 'long'>('medium');
  template = signal('Article');
  includeBackground = signal(true);
  includeWhatWeKnow = signal(false);
  includeRisks = signal(false);
  includeCallToAction = signal(false);
  citations = signal<'none' | 'placeholders' | 'explicit'>('placeholders');
  mustInclude = signal<string>('');
  mustAvoid = signal<string>('');
  bannedPhrases = signal<string>('');
  noDefamation = signal(true);
  noPersonalData = signal(true);
  noOperationalDetails = signal(false);
  mode = signal<'new' | 'revise_current'>('new');

  // Loading state
  generating = signal(false);

  // Options for dropdowns
  toneOptions = [
    { value: 'neutral', label: 'Neutral' },
    { value: 'formal', label: 'Formal' },
    { value: 'assertive', label: 'Assertive' },
    { value: 'empathetic', label: 'Empathetic' },
    { value: 'urgent', label: 'Urgent' },
    { value: 'diplomatic', label: 'Diplomatic' },
    { value: 'combative', label: 'Combative' },
    { value: 'reassuring', label: 'Reassuring' }
  ];

  styleOptions = [
    { value: 'AP_style', label: 'AP Style' },
    { value: 'Reuters', label: 'Reuters' },
    { value: 'Blog', label: 'Blog' },
    { value: 'Policy_memo', label: 'Policy Memo' },
    { value: 'Speechwriting', label: 'Speechwriting' },
    { value: 'Academic', label: 'Academic' },
    { value: 'Tabloid', label: 'Tabloid' }
  ];

  audienceOptions = [
    { value: 'general', label: 'General Public' },
    { value: 'journalists', label: 'Journalists' },
    { value: 'constituents', label: 'Constituents' },
    { value: 'internal_staff', label: 'Internal Staff' },
    { value: 'investors', label: 'Investors' },
    { value: 'international_partners', label: 'International Partners' },
    { value: 'security_briefing', label: 'Security Briefing' }
  ];

  templateOptions = [
    { value: 'Article', label: 'Article' },
    { value: 'Press_release', label: 'Press Release' },
    { value: 'Press_briefing', label: 'Press Briefing' }
  ];

  personaOptions = [
    { value: 'Journalist', label: 'Journalist' },
    { value: 'PR / Communications Professional', label: 'PR / Communications Professional' },
    { value: 'Politician / Public Official', label: 'Politician / Public Official' },
    { value: 'Corporate Executive / Company Spokesperson', label: 'Corporate Executive / Company Spokesperson' },
    { value: 'Content Marketer', label: 'Content Marketer' },
    { value: 'Industry Analyst / Subject-Matter Expert', label: 'Industry Analyst / Subject-Matter Expert' },
    { value: 'Academic / Researcher', label: 'Academic / Researcher' },
    { value: 'Nonprofit / Advocacy Organization Leader', label: 'Nonprofit / Advocacy Organization Leader' },
    { value: 'Influencer / Thought Leader', label: 'Influencer / Thought Leader' },
    { value: 'Technical Writer / Developer Evangelist', label: 'Technical Writer / Developer Evangelist' }
  ];

  ngOnInit() {
    // No initialization needed
  }

  onGenerate() {
    if (this.generating() || this.disabled()) {
      return;
    }

    this.generating.set(true);

    const generationInputs: GenerationInputs = {
      persona: {
        name: this.personaName(),
        details: this.personaDetails() || undefined
      },
      tone: this.tone(),
      style: this.style(),
      audience: this.audience(),
      format: {
        length: this.length(),
        template: this.template(),
        includeSections: {
          background: this.includeBackground(),
          whatWeKnow: this.includeWhatWeKnow(),
          risks: this.includeRisks(),
          callToAction: this.includeCallToAction()
        },
        citations: this.citations()
      },
      constraints: {
        mustInclude: this.mustInclude()
          ? this.mustInclude().split('\n').filter(x => x.trim())
          : [],
        mustAvoid: this.mustAvoid()
          ? this.mustAvoid().split('\n').filter(x => x.trim())
          : [],
        bannedPhrases: this.bannedPhrases()
          ? this.bannedPhrases().split('\n').filter(x => x.trim())
          : [],
        legalSafety: {
          noDefamation: this.noDefamation(),
          noPersonalData: this.noPersonalData(),
          noOperationalDetails: this.noOperationalDetails()
        }
      },
      model: 'gpt-4-turbo-preview',
      temperature: 0.6
    };

    const request: GenerationRequest = {
      sourceType: this.sourceType(),
      sourceText: this.sourceText(),
      sourceUrl: this.sourceUrl(),
      generationInputs,
      mode: this.mode()
    };

    this.generate.emit(request);

    // Reset generating state after a delay (parent will handle actual completion)
    setTimeout(() => {
      this.generating.set(false);
    }, 1000);
  }
}

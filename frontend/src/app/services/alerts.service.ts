import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, delay } from 'rxjs';
import { environment } from '../../environments/environment';

export type NotificationChannel = 'email' | 'mobile' | 'slack' | 'discord' | 'teams' | 'webhook';

export interface Alert {
  _id: string;
  name: string;
  keywords: string[];
  channels: NotificationChannel[];
  channelConfig: {
    email?: string;
    mobile?: string;
    slack?: string;
    discord?: string;
    teams?: string;
    webhook?: string;
  };
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertDto {
  name: string;
  keywords: string[];
  channels: NotificationChannel[];
  channelConfig: {
    email?: string;
    mobile?: string;
    slack?: string;
    discord?: string;
    teams?: string;
    webhook?: string;
  };
  enabled: boolean;
}

export interface UpdateAlertDto extends Partial<CreateAlertDto> {}

export interface ChannelOption {
  id: NotificationChannel;
  name: string;
  icon: string;
  placeholder: string;
  description: string;
}

@Injectable({
  providedIn: 'root'
})
export class AlertsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/alerts`;

  // Channel configuration options
  readonly channelOptions: ChannelOption[] = [
    {
      id: 'email',
      name: 'Email',
      icon: 'mail',
      placeholder: 'email@example.com',
      description: 'Receive alerts via email'
    },
    {
      id: 'mobile',
      name: 'Mobile',
      icon: 'smartphone',
      placeholder: '+1234567890',
      description: 'SMS or push notifications'
    },
    {
      id: 'slack',
      name: 'Slack',
      icon: 'hash',
      placeholder: 'https://hooks.slack.com/...',
      description: 'Post to a Slack channel'
    },
    {
      id: 'discord',
      name: 'Discord',
      icon: 'message-circle',
      placeholder: 'https://discord.com/api/webhooks/...',
      description: 'Post to a Discord channel'
    },
    {
      id: 'teams',
      name: 'Teams',
      icon: 'users',
      placeholder: 'https://outlook.office.com/webhook/...',
      description: 'Post to Microsoft Teams'
    },
    {
      id: 'webhook',
      name: 'Webhook',
      icon: 'globe',
      placeholder: 'https://your-api.com/webhook',
      description: 'Custom HTTP webhook'
    }
  ];

  // Stub implementations - replace with real API calls later

  getAlerts(): Observable<Alert[]> {
    // TODO: Replace with actual API call
    // return this.http.get<Alert[]>(this.baseUrl);

    // Stub data for development
    const stubAlerts: Alert[] = [
      {
        _id: '1',
        name: 'Breaking Tech News',
        keywords: ['AI', 'OpenAI', 'Google', 'Apple'],
        channels: ['email', 'slack'],
        channelConfig: {
          email: 'alerts@example.com',
          slack: 'https://hooks.slack.com/services/xxx'
        },
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      {
        _id: '2',
        name: 'Market Updates',
        keywords: ['stock', 'market', 'nasdaq', 'dow jones'],
        channels: ['mobile', 'teams'],
        channelConfig: {
          mobile: '+1234567890',
          teams: 'https://outlook.office.com/webhook/xxx'
        },
        enabled: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ];

    return of(stubAlerts).pipe(delay(500));
  }

  getAlert(id: string): Observable<Alert> {
    // TODO: Replace with actual API call
    // return this.http.get<Alert>(`${this.baseUrl}/${id}`);

    return of({
      _id: id,
      name: 'Sample Alert',
      keywords: ['keyword1', 'keyword2'],
      channels: ['email'] as NotificationChannel[],
      channelConfig: { email: 'test@example.com' },
      enabled: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }).pipe(delay(300));
  }

  createAlert(alert: CreateAlertDto): Observable<Alert> {
    // TODO: Replace with actual API call
    // return this.http.post<Alert>(this.baseUrl, alert);

    const newAlert: Alert = {
      _id: Math.random().toString(36).substring(7),
      ...alert,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return of(newAlert).pipe(delay(500));
  }

  updateAlert(id: string, alert: UpdateAlertDto): Observable<Alert> {
    // TODO: Replace with actual API call
    // return this.http.patch<Alert>(`${this.baseUrl}/${id}`, alert);

    const updatedAlert: Alert = {
      _id: id,
      name: alert.name || 'Updated Alert',
      keywords: alert.keywords || [],
      channels: alert.channels || [],
      channelConfig: alert.channelConfig || {},
      enabled: alert.enabled ?? true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    return of(updatedAlert).pipe(delay(500));
  }

  deleteAlert(id: string): Observable<void> {
    // TODO: Replace with actual API call
    // return this.http.delete<void>(`${this.baseUrl}/${id}`);

    return of(undefined).pipe(delay(300));
  }

  toggleAlert(id: string, enabled: boolean): Observable<Alert> {
    return this.updateAlert(id, { enabled });
  }
}

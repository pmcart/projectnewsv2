import { Component, OnInit, inject, signal, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  LucideAngularModule,
  Bell,
  Plus,
  Trash2,
  Edit3,
  Mail,
  Smartphone,
  Hash,
  MessageCircle,
  Users,
  Globe,
  X,
  Check,
  Power,
  PowerOff,
  AlertCircle,
  Tag
} from 'lucide-angular';
import {
  AlertsService,
  Alert,
  CreateAlertDto,
  NotificationChannel,
  ChannelOption
} from '../../services/alerts.service';

@Component({
  selector: 'app-alerts',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './alerts.html'
})
export class AlertsComponent implements OnInit {
  private readonly alertsService = inject(AlertsService);
  private readonly destroyRef = inject(DestroyRef);

  // Icons
  readonly icons = {
    Bell, Plus, Trash2, Edit3, Mail, Smartphone, Hash,
    MessageCircle, Users, Globe, X, Check, Power, PowerOff,
    AlertCircle, Tag
  };

  // State
  alerts = signal<Alert[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  saving = signal(false);

  // Modal state
  showModal = signal(false);
  editingAlert = signal<Alert | null>(null);

  // Form state
  formName = '';
  formKeywords = '';
  formEnabled = true;
  formChannels: NotificationChannel[] = [];
  formChannelConfig: Record<string, string> = {};

  // Channel options from service
  get channelOptions(): ChannelOption[] {
    return this.alertsService.channelOptions;
  }

  ngOnInit() {
    this.loadAlerts();
  }

  loadAlerts() {
    this.loading.set(true);
    this.error.set(null);

    this.alertsService.getAlerts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (alerts) => {
          this.alerts.set(alerts);
          this.loading.set(false);
        },
        error: (err) => {
          this.error.set('Failed to load alerts');
          this.loading.set(false);
          console.error('Error loading alerts:', err);
        }
      });
  }

  openCreateModal() {
    this.editingAlert.set(null);
    this.resetForm();
    this.showModal.set(true);
  }

  openEditModal(alert: Alert) {
    this.editingAlert.set(alert);
    this.formName = alert.name;
    this.formKeywords = alert.keywords.join(', ');
    this.formEnabled = alert.enabled;
    this.formChannels = [...alert.channels];
    this.formChannelConfig = { ...alert.channelConfig };
    this.showModal.set(true);
  }

  closeModal() {
    this.showModal.set(false);
    this.editingAlert.set(null);
    this.resetForm();
  }

  resetForm() {
    this.formName = '';
    this.formKeywords = '';
    this.formEnabled = true;
    this.formChannels = [];
    this.formChannelConfig = {};
  }

  toggleChannel(channelId: NotificationChannel) {
    const index = this.formChannels.indexOf(channelId);
    if (index === -1) {
      this.formChannels.push(channelId);
    } else {
      this.formChannels.splice(index, 1);
      delete this.formChannelConfig[channelId];
    }
  }

  isChannelSelected(channelId: NotificationChannel): boolean {
    return this.formChannels.includes(channelId);
  }

  getChannelIcon(channelId: NotificationChannel): any {
    const iconMap: Record<NotificationChannel, any> = {
      email: this.icons.Mail,
      mobile: this.icons.Smartphone,
      slack: this.icons.Hash,
      discord: this.icons.MessageCircle,
      teams: this.icons.Users,
      webhook: this.icons.Globe
    };
    return iconMap[channelId];
  }

  saveAlert() {
    if (!this.formName.trim() || !this.formKeywords.trim() || this.formChannels.length === 0) {
      return;
    }

    this.saving.set(true);

    const keywords = this.formKeywords
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    const alertData: CreateAlertDto = {
      name: this.formName.trim(),
      keywords,
      channels: this.formChannels,
      channelConfig: this.formChannelConfig,
      enabled: this.formEnabled
    };

    const editing = this.editingAlert();

    if (editing) {
      this.alertsService.updateAlert(editing._id, alertData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (updated) => {
            this.alerts.update(alerts =>
              alerts.map(a => a._id === updated._id ? updated : a)
            );
            this.saving.set(false);
            this.closeModal();
          },
          error: (err) => {
            this.saving.set(false);
            console.error('Error updating alert:', err);
          }
        });
    } else {
      this.alertsService.createAlert(alertData)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (created) => {
            this.alerts.update(alerts => [...alerts, created]);
            this.saving.set(false);
            this.closeModal();
          },
          error: (err) => {
            this.saving.set(false);
            console.error('Error creating alert:', err);
          }
        });
    }
  }

  deleteAlert(alert: Alert) {
    if (!confirm(`Are you sure you want to delete "${alert.name}"?`)) {
      return;
    }

    this.alertsService.deleteAlert(alert._id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.alerts.update(alerts => alerts.filter(a => a._id !== alert._id));
        },
        error: (err) => {
          console.error('Error deleting alert:', err);
        }
      });
  }

  toggleAlertEnabled(alert: Alert) {
    const newEnabled = !alert.enabled;

    this.alertsService.toggleAlert(alert._id, newEnabled)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.alerts.update(alerts =>
            alerts.map(a => a._id === alert._id ? { ...a, enabled: newEnabled } : a)
          );
        },
        error: (err) => {
          console.error('Error toggling alert:', err);
        }
      });
  }

  trackById(_index: number, alert: Alert): string {
    return alert._id;
  }

  getChannelPlaceholder(channelId: NotificationChannel): string {
    const channel = this.channelOptions.find(c => c.id === channelId);
    return channel?.placeholder || 'Enter configuration';
  }
}

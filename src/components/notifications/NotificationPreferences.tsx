import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationPreferences = () => {
  const { preferences, updatePreferences, loading } = useNotifications();

  if (loading || !preferences) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Manage how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading preferences...
          </div>
        </CardContent>
      </Card>
    );
  }

  const handleToggle = (key: keyof typeof preferences, value: boolean) => {
    updatePreferences({ [key]: value });
  };

  const preferenceGroups = [
    {
      title: 'General Notifications',
      items: [
        {
          key: 'email_notifications' as const,
          label: 'Email Notifications',
          description: 'Receive notifications via email',
        },
        {
          key: 'push_notifications' as const,
          label: 'Push Notifications',
          description: 'Receive browser push notifications',
        },
      ],
    },
    {
      title: 'Trading Alerts',
      items: [
        {
          key: 'trading_alerts' as const,
          label: 'Trading Alerts',
          description: 'Get notified about your trades and positions',
        },
        {
          key: 'signal_alerts' as const,
          label: 'Signal Alerts',
          description: 'Receive notifications for trading signals',
        },
        {
          key: 'price_alerts' as const,
          label: 'Price Alerts',
          description: 'Get notified when prices reach your targets',
        },
      ],
    },
    {
      title: 'Marketing',
      items: [
        {
          key: 'marketing_emails' as const,
          label: 'Marketing Emails',
          description: 'Receive updates about new features and promotions',
        },
      ],
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Manage how you receive notifications
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {preferenceGroups.map((group, groupIndex) => (
          <div key={group.title}>
            <h3 className="font-medium text-sm mb-4">{group.title}</h3>
            <div className="space-y-4">
              {group.items.map((item) => (
                <div key={item.key} className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor={item.key} className="text-sm font-medium">
                      {item.label}
                    </Label>
                    <div className="text-sm text-muted-foreground">
                      {item.description}
                    </div>
                  </div>
                  <Switch
                    id={item.key}
                    checked={preferences[item.key]}
                    onCheckedChange={(checked) => handleToggle(item.key, checked)}
                  />
                </div>
              ))}
            </div>
            {groupIndex < preferenceGroups.length - 1 && (
              <Separator className="mt-6" />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
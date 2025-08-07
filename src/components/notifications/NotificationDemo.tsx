import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useNotifications } from '@/hooks/useNotifications';

export const NotificationDemo = () => {
  const { createNotification } = useNotifications();

  const demoNotifications = [
    {
      title: 'Trade Executed',
      message: 'Your EUR/USD trade has been executed successfully',
      type: 'success' as const,
    },
    {
      title: 'Price Alert',
      message: 'GBP/USD has reached your target price of 1.2500',
      type: 'info' as const,
    },
    {
      title: 'Risk Warning',
      message: 'Your account balance is getting low. Consider adding funds.',
      type: 'warning' as const,
    },
    {
      title: 'Connection Lost',
      message: 'Connection to market data lost. Reconnecting...',
      type: 'error' as const,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Demo</CardTitle>
        <CardDescription>
          Test the notification system with sample notifications
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {demoNotifications.map((notification, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => createNotification(notification)}
            >
              {notification.title}
            </Button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
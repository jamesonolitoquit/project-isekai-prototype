import React, { useEffect, useState } from 'react';
import type { Event } from '../../events/mutationLog';

interface Notification {
  id: string;
  event: Event;
  createdAt: number;
  expiresAt: number;
}

interface NotificationOverlayProps {
  events?: Event[]; // Recent events to display
  maxNotifications?: number;
  toastDuration?: number; // ms
}

// Type-safe payload extraction helpers
const getPayloadField = (payload: any, field: string, fallback: string | number = '?'): string | number => {
  return (payload && typeof payload === 'object' && field in payload) ? payload[field] : fallback;
};

const NotificationOverlay: React.FC<NotificationOverlayProps> = ({ 
  events = [], 
  maxNotifications = 5,
  toastDuration = 4000 
}) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    const now = Date.now();
    
    // Add new events as notifications
    events.forEach((event) => {
      const existingId = notifications.findIndex(n => n.event.id === event.id);
      
      if (existingId === -1) {
        const newNotification: Notification = {
          id: `${event.id}-${now}`,
          event,
          createdAt: now,
          expiresAt: now + toastDuration,
        };
        
        setNotifications((prev) => {
          const updated = [...prev, newNotification];
          // Keep only the most recent notifications
          return updated.slice(Math.max(0, updated.length - maxNotifications));
        });
      }
    });

    // Clean up expired notifications
    const cleanup = setInterval(() => {
      setNotifications((prev) => {
        const now = Date.now();
        return prev.filter((n) => n.expiresAt > now);
      });
    }, 500);

    return () => clearInterval(cleanup);
  }, [events, maxNotifications, toastDuration]);

  const styles = {
    container: {
      position: 'fixed' as const,
      bottom: '20px',
      right: '20px',
      zIndex: 999,
      display: 'flex',
      flexDirection: 'column' as const,
      gap: '8px',
      maxWidth: '320px'
    },
    toast: (progress: number) => ({
      padding: '12px 16px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#000',
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      animation: `slideInRight 0.3s ease-out`,
      opacity: progress,
      transform: `translateX(${(1 - progress) * 20}px)`,
      transition: 'opacity 0.3s, transform 0.3s',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)'
    }),
    progressBar: {
      position: 'absolute' as const,
      bottom: 0,
      left: 0,
      height: '3px',
      backgroundColor: 'currentColor',
      opacity: 0.5,
      animation: `shrink var(--duration, 4s) linear forwards`
    }
  };

  // CSS animations
  const animationStyle = `
    @keyframes slideInRight {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    @keyframes shrink {
      from {
        width: 100%;
      }
      to {
        width: 0;
      }
    }

    .notification-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .notification-text {
      flex: 1;
    }

    .notification-amount {
      font-weight: bold;
      margin-left: 4px;
    }
  `;

  const getNotificationStyle = (eventType: string) => {
    const baseStyles = {
      position: 'relative' as const,
      overflow: 'hidden' as const,
      minHeight: '40px',
      display: 'flex',
      alignItems: 'center'
    };

    switch (eventType) {
      case 'XP_GAINED':
        return { ...baseStyles, backgroundColor: '#ffaa00', color: '#fff' };
      case 'GOLD_RECEIVED':
        return { ...baseStyles, backgroundColor: '#ffdd00', color: '#000' };
      case 'LEVEL_UP':
        return { ...baseStyles, backgroundColor: '#0f0', color: '#000', fontWeight: 'bold' as const };
      case 'ITEM_RECEIVED':
        return { ...baseStyles, backgroundColor: '#0af', color: '#fff' };
      case 'ABILITY_LEARNED':
        return { ...baseStyles, backgroundColor: '#a0f', color: '#fff' };
      case 'QUEST_COMPLETE':
        return { ...baseStyles, backgroundColor: '#0f0', color: '#000' };
      case 'QUEST_PROGRESS':
        return { ...baseStyles, backgroundColor: '#0aa', color: '#000' };
      case 'ENEMY_DEFEATED':
        return { ...baseStyles, backgroundColor: '#f00', color: '#fff' };
      case 'STATUS_EFFECT':
        return { ...baseStyles, backgroundColor: '#aa0', color: '#000' };
      default:
        return { ...baseStyles, backgroundColor: '#666', color: '#fff' };
    }
  };

  const getNotificationContent = (event: Event) => {
    const payload = event.payload || {};
    switch (event.type) {
      case 'XP_GAINED':
        return {
          icon: '✦',
          text: `XP Gained`,
          amount: getPayloadField(payload, 'amount')
        };
      case 'GOLD_RECEIVED':
        return {
          icon: '¥',
          text: 'Gold Received',
          amount: `${getPayloadField(payload, 'amount')}g`
        };
      case 'LEVEL_UP':
        return {
          icon: '▲',
          text: `Level Up!`,
          amount: `→ ${getPayloadField(payload, 'newLevel')}`
        };
      case 'ITEM_RECEIVED':
        return {
          icon: '◆',
          text: 'Item Received',
          amount: getPayloadField(payload, 'itemName')
        };
      case 'ABILITY_LEARNED':
        return {
          icon: '★',
          text: 'Ability Learned',
          amount: getPayloadField(payload, 'abilityName')
        };
      case 'QUEST_COMPLETE':
        return {
          icon: '✓',
          text: 'Quest Complete',
          amount: getPayloadField(payload, 'questName')
        };
      case 'QUEST_PROGRESS':
        return {
          icon: '→',
          text: 'Quest Progress',
          amount: getPayloadField(payload, 'objective')
        };
      case 'ENEMY_DEFEATED':
        return {
          icon: '✕',
          text: 'Enemy Defeated',
          amount: getPayloadField(payload, 'enemyName')
        };
      case 'STATUS_EFFECT':
        return {
          icon: '◉',
          text: getPayloadField(payload, 'effectName', 'Status Applied') as string | number,
          amount: `${getPayloadField(payload, 'duration')}s`
        };
      default:
        return {
          icon: '•',
          text: event.type,
          amount: ''
        };
    }
  };

  return (
    <>
      <style>{animationStyle}</style>
      <div style={styles.container}>
        {notifications.map((notification) => {
          const progress = Math.max(
            0,
            (notification.expiresAt - Date.now()) / toastDuration
          );
          const content = getNotificationContent(notification.event);
          const notifStyle = getNotificationStyle(notification.event.type);

          return (
            <div
              key={notification.id}
              style={{
                ...notifStyle,
                ...styles.toast(progress > 0 ? 1 : 0)
              }}
            >
              <div className="notification-icon">{content.icon}</div>
              <div className="notification-text">
                {content.text}
                {content.amount && (
                  <span className="notification-amount">{content.amount}</span>
                )}
              </div>
              <div
                style={{
                  ...styles.progressBar,
                  '--duration': `${toastDuration}ms`
                } as React.CSSProperties}
              />
            </div>
          );
        })}
      </div>
    </>
  );
};

export default NotificationOverlay;

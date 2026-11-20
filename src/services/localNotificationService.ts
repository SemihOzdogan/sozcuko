import notifee, { EventType } from '@notifee/react-native';

const DUEL_CHANNEL_ID = 'duel-invitations';

export const configureLocalNotifications = async () => {
  await notifee.requestPermission();
  await notifee.createChannel({
    id: DUEL_CHANNEL_ID,
    name: 'Düello davetleri',
    description: 'Gelen düello davetleri',
    importance: 4,
  });
};

export const showDuelInvitationNotification = async (roomId: string) => {
  await notifee.displayNotification({
    id: `duel-invitation-${roomId}`,
    title: 'Yeni düello daveti',
    body: 'Bir oyuncu seni düelloya çağırıyor.',
    data: { roomId },
    android: {
      channelId: DUEL_CHANNEL_ID,
      pressAction: { id: 'open-duel' },
      smallIcon: 'ic_launcher',
    },
    ios: {
      foregroundPresentationOptions: {
        alert: true,
        badge: true,
        sound: true,
      },
    },
  });
};

export const subscribeToNotificationPress = (
  onPress: (roomId?: string) => void,
) =>
  notifee.onForegroundEvent(({ type, detail }) => {
    const roomId = detail.notification?.data?.roomId;
    if (type === EventType.PRESS && typeof roomId === 'string') onPress(roomId);
  });

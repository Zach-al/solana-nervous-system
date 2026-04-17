import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import { getHealth } from './solnetApi';
import { useEarningsStore } from '../stores/earningsStore';
import { useNodeStore } from '../stores/nodeStore';

const BACKGROUND_FETCH_TASK = 'SOLNET_HEARTBEAT';

TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const { isActive } = useNodeStore.getState();
    if (!isActive) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    const health = await getHealth();
    if (!health) {
      useNodeStore.getState().setOffline();
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    const earningsStore = useEarningsStore.getState();
    const previousEarnings = earningsStore.lifetimeLamports;
    
    useNodeStore.getState().updateFromHealth(health);
    earningsStore.updateEarnings(health);

    const newEarnings = earningsStore.lifetimeLamports;
    
    // Milestone boundaries
    if (Math.floor(newEarnings / 1e7) > Math.floor(previousEarnings / 1e7)) {
      await Notifications.scheduleNotificationAsync({
        content: {
          title: '💰 New Earning Milestone!',
          body: `You've earned ${(newEarnings / 1e9).toFixed(5)} SOL by routing traffic.`,
        },
        trigger: null,
      });
    }

    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (error) {
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export async function registerBackgroundFetchAsync() {
  return BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
    minimumInterval: 15 * 60,
    stopOnTerminate: false,
    startOnBoot: true,
  });
}

export async function unregisterBackgroundFetchAsync() {
  const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_FETCH_TASK);
  if (isRegistered) {
    return BackgroundFetch.unregisterTaskAsync(BACKGROUND_FETCH_TASK);
  }
}

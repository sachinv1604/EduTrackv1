/**
 * Scheduled Notifications Utility
 * 
 * This module runs a background job every minute using node-cron.
 * It checks for routes that have scheduled daily start times but are not active (offline).
 * If a route is 15, 10, or 5 minutes away from starting, it sends a push notification
 * reminder to the driver.
 */
const cron = require('node-cron');
const Route = require('../models/Route');
const fcm = require('./fcm');

// Default offset: 330 minutes (5 hours 30 mins) for Indian Standard Time (IST)
const TIMEZONE_OFFSET_MINS = process.env.TIMEZONE_OFFSET 
  ? parseInt(process.env.TIMEZONE_OFFSET, 10) 
  : 330; 

console.log(`[Scheduler] Initializing trip start reminder cron job. Timezone Offset: ${TIMEZONE_OFFSET_MINS}m`);

// Run every minute
cron.schedule('* * * * *', async () => {
  try {
    // 1. Calculate current local time based on the configured timezone offset
    const now = new Date();
    // getTimezoneOffset returns the offset in minutes with opposite sign (e.g. UTC+5:30 -> -330)
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const localDate = new Date(utcTime + (TIMEZONE_OFFSET_MINS * 60000));

    const curHour = localDate.getHours();
    const curMin = localDate.getMinutes();
    const curMinsOfDay = curHour * 60 + curMin;

    // 2. Fetch all routes with a scheduled start time that are currently INACTIVE (offline)
    const routes = await Route.find({
      dailyStartTime: { $ne: null },
      isActive: false
    }).populate('driverId');

    if (routes.length === 0) {
      return;
    }

    for (const route of routes) {
      if (!route.driverId || !route.driverId.fcmToken) {
        continue;
      }

      // 3. Calculate difference in minutes between schedule start and current local time
      const [startHour, startMin] = route.dailyStartTime.split(':').map(Number);
      const startMinsOfDay = startHour * 60 + startMin;

      let diff = startMinsOfDay - curMinsOfDay;
      if (diff < 0) {
        diff += 1440; // Handle midnight wrap around
      }

      // 4. Send reminders at 15m, 10m, and 5m before start time
      if (diff === 15) {
        console.log(`[Scheduler] Sending 15m reminder to driver: ${route.driverId.name} for Route: ${route.name}`);
        await fcm.sendPushNotification(
          route.driverId.fcmToken,
          'Trip Start Reminder ⏰',
          `Your trip for Route "${route.name}" is scheduled to start in 15 minutes. Please turn on the trip.`,
          { routeId: route._id.toString(), type: 'TRIP_REMINDER', minutesLeft: '15' }
        );
      } else if (diff === 10) {
        console.log(`[Scheduler] Sending 10m reminder to driver: ${route.driverId.name} for Route: ${route.name}`);
        await fcm.sendPushNotification(
          route.driverId.fcmToken,
          'Trip Start Reminder ⏰',
          `Your trip for Route "${route.name}" is scheduled to start in 10 minutes. Don't forget to turn on the trip.`,
          { routeId: route._id.toString(), type: 'TRIP_REMINDER', minutesLeft: '10' }
        );
      } else if (diff === 5) {
        console.log(`[Scheduler] Sending 5m urgent reminder to driver: ${route.driverId.name} for Route: ${route.name}`);
        await fcm.sendPushNotification(
          route.driverId.fcmToken,
          'Trip Start Urgent Reminder 🚨',
          `Your trip for Route "${route.name}" starts in 5 minutes! Turn on the trip to share live location with students.`,
          { routeId: route._id.toString(), type: 'TRIP_REMINDER', minutesLeft: '5' }
        );
      }
    }
  } catch (error) {
    console.error('[Scheduler_ERR] Error in reminder scheduler:', error);
  }
});

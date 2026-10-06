const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const webpush = require('web-push');

initializeApp();

const vapidPrivateKey = defineSecret('VAPID_PRIVATE_KEY');
const VAPID_PUBLIC_KEY = 'BBLVoXFRiUDSV72gImtZXfRgu92qgCEmBY-nByHqKDiaQrB7uEkvAWRo-D6VtQlHmtESAFH7bpPMImL2uXOu5dY';

function guestMayChat(eventData, rsvp) {
  if (!rsvp || rsvp.status !== 'yes') return false;
  if (eventData.requireGuestApproval !== true) return true;
  return !rsvp.approvalStatus || rsvp.approvalStatus === 'approved';
}

function notificationBody(message) {
  const content = message.type === 'poll'
    ? `New poll: ${message.pollQuestion || 'Open the chat to vote'}`
    : message.text || 'A new message was posted.';
  return content.length > 180 ? `${content.slice(0, 177)}…` : content;
}

exports.notifyEventChat = onDocumentCreated(
  {
    document: 'events/{eventId}/chat/{messageId}',
    region: 'us-central1',
    secrets: [vapidPrivateKey],
    retry: false,
  },
  async (event) => {
    const message = event.data?.data();
    if (!message || message.deleted === true) return;

    const db = getFirestore();
    const eventRef = db.doc(`events/${event.params.eventId}`);
    const [eventSnapshot, subscriptionsSnapshot, rsvpsSnapshot] = await Promise.all([
      eventRef.get(),
      eventRef.collection('pushSubscriptions').get(),
      eventRef.collection('rsvps').get(),
    ]);
    if (!eventSnapshot.exists || subscriptionsSnapshot.empty) return;

    const eventData = eventSnapshot.data() || {};
    const rsvps = new Map(rsvpsSnapshot.docs.map((document) => [document.id, document.data()]));
    const recipients = subscriptionsSnapshot.docs.filter((document) => {
      const subscription = document.data();
      if (subscription.actorUid === message.authorUid && subscription.actorRole === message.authorRole)
        return false;
      return subscription.actorRole === 'host'
        || (subscription.actorRole === 'guest' && guestMayChat(eventData, rsvps.get(subscription.actorUid)));
    });
    if (!recipients.length) return;

    webpush.setVapidDetails(
      'mailto:alaki.dolaki.holholaki@gmail.com',
      VAPID_PUBLIC_KEY,
      vapidPrivateKey.value(),
    );

    const title = `${message.authorName || 'Someone'} · ${eventData.title || 'Gather'}`;
    const tag = `gather-chat-${event.params.eventId}`;
    const staleSubscriptions = [];
    const deliveries = await Promise.allSettled(recipients.map(async (document) => {
      const subscription = document.data();
      const url = subscription.actorRole === 'host'
        ? `./?view=host&event=${encodeURIComponent(event.params.eventId)}`
        : `./?event=${encodeURIComponent(event.params.eventId)}`;
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            expirationTime: subscription.expirationTime || null,
            keys: subscription.keys,
          },
          JSON.stringify({ title, body: notificationBody(message), tag, url }),
          { TTL: 86400, urgency: 'high' },
        );
      } catch (error) {
        if (error?.statusCode === 404 || error?.statusCode === 410) {
          staleSubscriptions.push(document.ref);
          return;
        }
        throw error;
      }
    }));

    if (staleSubscriptions.length) {
      const batch = db.batch();
      staleSubscriptions.forEach((reference) => batch.delete(reference));
      await batch.commit();
    }
    const failures = deliveries.filter((result) => result.status === 'rejected');
    if (failures.length) logger.error('Some chat notifications failed', {
      eventId: event.params.eventId,
      failed: failures.length,
      attempted: recipients.length,
    });
  },
);

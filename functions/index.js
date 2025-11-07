// functions/index.js

const { onDocumentCreated, onDocumentDeleted } = require("firebase-functions/v2/firestore");
const { onRequest } = require("firebase-functions/v2/https");
const { logger } = require("firebase-functions");
const admin = require("firebase-admin");
const fetch = require("node-fetch"); // Use require for node-fetch

// Initialize Firebase Admin SDK ONCE
admin.initializeApp();
const db = admin.firestore();

// ============================================================
// 1. NOTIFICATION CREATION from notification_inbox
// ============================================================
/**
 * TRIGGER: Runs when a new document is created in /notification_inbox.
 * ACTION: Creates a personalized notification in the target user's subcollection.
 * This is the central function for creating all client-triggered notifications.
 */
exports.createNotificationFromInbox = onDocumentCreated("notification_inbox/{eventId}", async (event) => {
    const eventData = event.data.data();
    const { targetUserId, message, type, link, senderName } = eventData;

    if (!targetUserId) {
        logger.error("No targetUserId found, aborting notification.", { eventId: event.params.eventId });
        return null;
    }

    const notificationPayload = {
        message,
        type,
        link: link || "#",
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        senderName: senderName || "System",
    };

    try {
        await db.collection("users").doc(targetUserId).collection("notifications").add(notificationPayload);
        logger.log(`Successfully created notification for user ${targetUserId}`);
        // Clean up the event from the inbox after processing
        return event.data.ref.delete();
    } catch (error) {
        logger.error(`Failed to create notification for user ${targetUserId}:`, error);
        return null;
    }
});


// ============================================================
// 2. DISCUSSION & REPLY COUNTERS
// ============================================================
/**
 * TRIGGER: Runs when a new reply is created.
 * ACTION: Atomically increments the replyCount on the parent discussion document.
 * Note: The notification logic is now handled on the client via notification_inbox.
 */
exports.incrementReplyCount = onDocumentCreated("discussions/{threadId}/replies/{replyId}", async (event) => {
    const threadId = event.params.threadId;
    const threadRef = db.collection("discussions").doc(threadId);

    try {
        await threadRef.update({ replyCount: admin.firestore.FieldValue.increment(1) });
        logger.log(`Incremented reply count for thread: ${threadId}`);
    } catch (error) {
        logger.error("Error incrementing reply count:", error);
    }
});

/**
 * TRIGGER: Runs when a reply is deleted.
 * ACTION: Atomically decrements the replyCount.
 */
exports.decrementReplyCount = onDocumentDeleted("discussions/{threadId}/replies/{replyId}", async (event) => {
    const threadId = event.params.threadId;
    const threadRef = db.collection("discussions").doc(threadId);

    try {
        await threadRef.update({ replyCount: admin.firestore.FieldValue.increment(-1) });
        logger.log(`Decremented reply count for thread: ${threadId}`);
    } catch (error) {
        logger.error("Error decrementing reply count:", error);
    }
});


// ============================================================
// 3. BROADCAST NOTIFICATION for new content
// ============================================================
/**
 * TRIGGER: Runs when new contributed content is added.
 * ACTION: Sends a notification to ALL users (except the creator).
 */
exports.broadcastNewContentNotification = onDocumentCreated("contributed/{contentId}", async (event) => {
    const contentData = event.data.data();
    const notificationPayload = {
        message: `Une nouvelle ressource a été ajoutée : <strong>${contentData.title || "Nouveau contenu"}</strong>`,
        type: "new_content",
        link: "/contributed",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        read: false,
        senderName: contentData.userName || "Un contributeur",
    };

    try {
        const usersSnapshot = await db.collection("users").get();
        const batch = db.batch();
        
        let notifiedCount = 0;
        usersSnapshot.forEach((userDoc) => {
            if (userDoc.id !== contentData.userId) { // Don't notify the creator
                const userNotifRef = db.collection("users").doc(userDoc.id).collection("notifications").doc();
                batch.set(userNotifRef, notificationPayload);
                notifiedCount++;
            }
        });

        await batch.commit();
        logger.log(`Broadcast notification sent to ${notifiedCount} users.`);
    } catch (error) {
        logger.error("Error sending broadcast notification:", error);
    }
});



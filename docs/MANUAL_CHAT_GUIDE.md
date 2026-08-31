# mywedcrew.com - Manual Subscription & Chat Guide

This guide explains how the newly integrated Subscription and Chat system operates using the manual Admin-controlled workflow.

## Overview
The chat system between a Company and a Freelancer is strictly governed by their subscription status. Both parties must have an active subscription with the **chat feature** enabled to communicate.

### Simple Example Flow
Admin activates Company subscription
+
Admin activates Freelancer subscription
+
Both plans have chat enabled
=
They can start chatting.

---

## 1. How Admin Manually Activates a Subscription
Currently, subscriptions are managed manually (pre-Razorpay integration).
- **Navigate to Admin Dashboard**: Log in as an Admin and open the **Subscriptions** tab.
- **Select User**: Use the search/filter tools to find the specific Company or Freelancer.
- **Assign & Activate**: Assign a Plan (e.g., PRO, PREMIUM), manually set the status to **ACTIVE**, and define the **Expiry Date**.
- **Chat Feature**: Ensure the selected plan has the chat feature enabled. The system will now recognize this user as eligible for chat.

## 2. How Users Get Chat Access
For a chat to be available:
`Company ACTIVE subscription` + `Freelancer ACTIVE subscription` + `Chat feature enabled` = **Chat Available**

If either party's subscription is missing, expired, paused, or cancelled, the chat becomes **Locked**.

## 3. How to Start a Chat
1. After a business relationship is established (e.g., a Company reviews a Freelancer's proposal on a Requirement), the eligible Company can initiate communication.
2. This creates a secure, one-to-one conversation tied to that specific requirement/booking.

## 4. Sending and Receiving Messages
- Both users access the chat via the **Messages** tab on their respective dashboards (Company Dashboard / Freelancer Dashboard).
- The interface displays the conversation list on the left and the active chat window on the right.
- Users can type messages and hit send. The backend verifies their authentication, conversation authorization, and subscription status before saving the message to MongoDB.

## 5. Real-Time Chat (Socket.IO)
- As long as both users are online, messages are delivered instantly via Socket.IO.
- If a user is offline, the message is stored securely in the database, updating their unread message count so they see it the next time they log in.

## 6. What Happens When a Subscription Expires?
If either the Company or the Freelancer's subscription expires (or is manually paused/cancelled by the Admin):
- **Chat is Locked**: The input box disables automatically, preventing new messages from being sent.
- **Data is Safe**: Existing conversations and messages are **NOT deleted**. Users will simply see a banner explaining that their subscription has expired.

## 7. Reactivating a Subscription
- If an expired user renews their subscription (or the Admin manually extends their expiry date), the chat is instantly unlocked.
- Previous messages become fully accessible and users can seamlessly continue their conversation right where they left off.

## 8. Quick Admin Setup Example

Here is a simple, real-world flow to get a Company and a Freelancer chatting today:

1. **Admin Dashboard → Subscriptions**
2. Select **Company** → Assign PRO/PREMIUM → **ACTIVE** → Set expiry date
3. Select **Freelancer** → Assign PRO/PREMIUM → **ACTIVE** → Set expiry date
4. Make sure the selected plans have the `chat` feature enabled
5. Company opens the eligible Freelancer proposal/profile
6. Company clicks **Start Chat**
7. Conversation appears under **Messages**
8. Freelancer opens **Messages** and can reply

### If Chat Does Not Appear

Check:
- Company subscription is **ACTIVE**
- Freelancer subscription is **ACTIVE**
- Both plans have `chat` feature enabled
- Subscription expiry date has not passed
- A valid proposal/requirement/booking relationship exists
- User is logged in with the correct account

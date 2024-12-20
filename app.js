import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import {
  getMessaging,
  getToken,
  onMessage,
} from "https://www.gstatic.com/firebasejs/9.15.0/firebase-messaging.js";
import { config } from "./config.js";

// Initialize Firebase with config
const firebaseApp = initializeApp(config.firebase);
const messaging = getMessaging(firebaseApp);

// Check interval (every 60 minutes)
const TOKEN_CHECK_INTERVAL = 60 * 60 * 1000;

// Function to generate new FCM token
async function generateNewToken(registration) {
  try {
    const token = await getToken(messaging, {
      vapidKey: config.firebase.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("New FCM Token generated");
      document.getElementById("fcmTokenDisplay").textContent = token;
      return token;
    } else {
      throw new Error("Failed to generate FCM token.");
    }
  } catch (error) {
    console.error("Error generating new FCM token:", error);
    throw error;
  }
}

// Function to refresh token if needed
async function refreshTokenIfNeeded(registration) {
  try {
    const currentToken = await getToken(messaging, {
      vapidKey: config.firebase.vapidKey,
      serviceWorkerRegistration: registration,
    });

    if (!currentToken) {
      console.log("No current token found, generating new token");
      return await generateNewToken(registration);
    }

    console.log("Current token is still valid");
    document.getElementById("fcmTokenDisplay").textContent = currentToken;
    return currentToken;
  } catch (error) {
    console.error("Error in refreshTokenIfNeeded:", error);
    throw error;
  }
}

// Register service worker and set up token management
async function registerServiceWorker() {
  try {
    const registration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js"
    );

    // Initial token generation/validation
    await refreshTokenIfNeeded(registration);

    // Set up periodic token checking
    setInterval(async () => {
      try {
        await refreshTokenIfNeeded(registration);
      } catch (error) {
        console.error("Failed to refresh token:", error);
      }
    }, TOKEN_CHECK_INTERVAL);
  } catch (error) {
    console.error("Error in service worker registration:", error);
  }
}

// Handle incoming messages
onMessage(messaging, (payload) => {
  console.log("Message received:", payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: payload.notification.icon,
  };

  if (Notification.permission === "granted") {
    new Notification(notificationTitle, notificationOptions);
  } else {
    console.warn("Notifications are not permitted.");
  }

  const logElement = document.getElementById("incomingMessageLog");
  document.querySelector("#incomingMessageLog span").textContent = "";
  logElement.textContent += JSON.stringify(payload, null, 2) + "\n---\n";
});

// Call the function to register the service worker
registerServiceWorker();

// Handle sending messages
document
  .getElementById("sendMessageButton")
  .addEventListener("click", async () => {
    const message = document.getElementById("message").value;
    const modelId = document.getElementById("modelId").value;
    const modelType = document.getElementById("modelType").value;

    const payload = {
      message: message,
      model_id: parseInt(modelId, 10),
      model_type: modelType,
    };

    try {
      // Send message to the API; this will trigger a push notification. You can replace this with your own api setup.
      const response = await fetch(`${config.api.baseUrl}/api/chats/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.api.authToken}`,
        },
        body: JSON.stringify(payload),
      });

      const responseData = await response.json();
      document.getElementById("apiResponse").textContent = JSON.stringify(
        responseData,
        null,
        2
      );
    } catch (err) {
      console.error("Error sending message:", err);
      document.getElementById("apiResponse").textContent =
        "Error: " + err.message;
    }
  });

/**
 * 💬 WhatsApp Service — @whiskeysockets/baileys (Open Source, Free, Socket-based)
 * QR Code scan කර ඕනෑම WhatsApp number වෙත message send කිරීමේ शक्यता.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

let client = null;
let isReady = false;
let qrCodeData = null;
let initializationPromise = null;
let reconnectAttempts = 0;
// An unscanned QR gets disconnected by WhatsApp's servers every ~2-3 minutes, and each
// reconnect spins up a brand-new Baileys socket (fresh event listeners, a fetchLatestBaileysVersion
// network call, etc.). Left uncapped, this ran indefinitely on a host nobody was watching and the
// service OOM-restarted every 20-25 minutes - stop auto-retrying after a while instead; scanning the
// QR (which resets this counter via a fresh 'open' connection) or restarting the process resumes it.
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * WhatsApp Client initialize කිරීම (Server start වූ විට)
 */
const initWhatsApp = async () => {
  if (initializationPromise) return initializationPromise;

  initializationPromise = (async () => {
    console.log('📱 WhatsApp Service: Initializing Baileys Socket...');

    try {
      const { state, saveCreds } = await useMultiFileAuthState('./whatsapp-session');
      const { version } = await fetchLatestBaileysVersion();

      client = makeWASocket({
        auth: state,
        version,
        logger: pino({ level: 'silent' }),
        printQRInTerminal: false, // We will handle printing manually below
      });

      client.ev.on('creds.update', saveCreds);

      client.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
          console.log('\n📲 WhatsApp QR Code (Scan with your phone):');
          qrcode.generate(qr, { small: true });
          qrCodeData = qr;
          isReady = false;
        }

        if (connection === 'close') {
          const statusCode = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.statusCode;
          const shouldReconnect = statusCode !== DisconnectReason.loggedOut && statusCode !== 405 && statusCode !== 401;
          
          console.log(`⚠️ WhatsApp Disconnected: statusCode=${statusCode}, shouldReconnect=${shouldReconnect}`);
          isReady = false;
          qrCodeData = null;
          client = null;
          initializationPromise = null;

          if (shouldReconnect && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`🔄 WhatsApp: Attempting reconnect in 5 seconds... (${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(() => {
              initWhatsApp();
            }, 5000);
          } else if (shouldReconnect) {
            console.log('🛑 WhatsApp: Max reconnect attempts reached - giving up until the server restarts.');
          } else {
            console.log('🚪 WhatsApp: Logged out successfully. Cleaning up session and restarting...');
            const fs = require('fs');
            if (fs.existsSync('./whatsapp-session')) {
              try {
                fs.rmSync('./whatsapp-session', { recursive: true, force: true });
                console.log('🗑️ WhatsApp: Old session deleted.');
              } catch (e) {
                console.error('⚠️ WhatsApp: Failed to delete session folder:', e.message);
              }
            }
            setTimeout(() => {
              initWhatsApp();
            }, 3000);
          }
        } else if (connection === 'open') {
          console.log('✅ WhatsApp Client Ready! Messages can now be sent.');
          isReady = true;
          qrCodeData = null;
          reconnectAttempts = 0;
        }
      });

      return { success: true };
    } catch (err) {
      console.error('❌ WhatsApp Client Init Error:', err.message);
      isReady = false;
      initializationPromise = null;
      return { success: false, error: err.message };
    }
  })();

  return initializationPromise;
};

/**
 * 📱 WhatsApp message send කිරීම
 * @param {string} phone — "+94XXXXXXXXX" හෝ "94XXXXXXXXX" format
 * @param {string} message — Send කළ යුතු message
 * @returns {{ success: boolean, mock?: boolean, error?: string }}
 */
const sendWhatsAppMessage = async (phone, message) => {
  try {
    // Phone number normalize: +94771234567 → 94771234567@s.whatsapp.net
    let normalized = phone.replace(/\D/g, ''); // digits only
    if (normalized.startsWith('0')) {
      // Local Sri Lanka format: 0771234567 → 94771234567
      normalized = '94' + normalized.substring(1);
    }
    const chatId = `${normalized}@s.whatsapp.net`;

    if (!isReady || !client) {
      // Mock mode: log to console if not connected
      console.log(`[WhatsApp MOCK - Not Connected] To: ${chatId} | Message: ${message}`);
      return { success: false, mock: true, error: 'WhatsApp client not ready. Scan QR code first.' };
    }

    // Check if number exists on WhatsApp
    const [result] = await client.onWhatsApp(chatId);
    if (!result || !result.exists) {
      console.warn(`⚠️ WhatsApp: Number ${chatId} is not registered on WhatsApp.`);
      return { success: false, error: 'Number not registered on WhatsApp' };
    }

    await client.sendMessage(chatId, { text: message });
    console.log(`✅ WhatsApp sent to ${chatId}`);
    return { success: true };
  } catch (error) {
    console.error(`❌ WhatsApp send error to ${phone}:`, error.message);
    return { success: false, error: error.message };
  }
};

/**
 * QR Code data ලබාගැනීම (Frontend display සඳහා)
 */
const getQrCode = () => qrCodeData;

/**
 * Connection status ලබාගැනීම
 */
const getStatus = () => ({
  isReady,
  hasQr: !!qrCodeData,
  status: isReady ? 'Connected' : (qrCodeData ? 'Waiting for QR Scan' : 'Disconnected')
});

/**
 * WhatsApp client logout
 */
const logoutWhatsApp = async () => {
  if (client) {
    try {
      await client.logout();
    } catch (e) {
      console.error('Error during logout:', e.message);
    }
    client = null;
    isReady = false;
    qrCodeData = null;
    initializationPromise = null;
    console.log('🚪 WhatsApp: Logged out.');
    return { success: true };
  }
  return { success: false, error: 'No active session.' };
};

module.exports = {
  initWhatsApp,
  sendWhatsAppMessage,
  getQrCode,
  getStatus,
  logoutWhatsApp
};

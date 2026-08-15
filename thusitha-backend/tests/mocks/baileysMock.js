module.exports = {
  default: jest.fn(() => ({})),
  useMultiFileAuthState: jest.fn(() => ({ state: {}, saveCreds: jest.fn() })),
  DisconnectReason: { loggedOut: 401 }
};

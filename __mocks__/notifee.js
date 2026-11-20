const listeners = new Set();

const notifee = {
  requestPermission: jest.fn(async () => ({})),
  createChannel: jest.fn(async ({ id }) => id),
  displayNotification: jest.fn(async () => 'mock-notification'),
  onForegroundEvent: jest.fn(listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }),
};

module.exports = notifee;
module.exports.default = notifee;
module.exports.EventType = { PRESS: 1 };

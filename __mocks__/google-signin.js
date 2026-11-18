module.exports = {
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn(async () => true),
    signOut: jest.fn(async () => undefined),
    signIn: jest.fn(async () => ({ type: 'cancelled' })),
    getTokens: jest.fn(async () => ({ idToken: null, accessToken: null })),
  },
};

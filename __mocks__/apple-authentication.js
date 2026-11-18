const React = require('react');
const { Pressable, Text } = require('react-native');

const AppleButton = props =>
  React.createElement(
    Pressable,
    { ...props, onPress: props.onPress },
    React.createElement(Text, null, 'Apple ile devam et'),
  );

AppleButton.Type = { CONTINUE: 'continue' };
AppleButton.Style = { BLACK: 'black' };

module.exports = {
  appleAuth: {
    Operation: { LOGIN: 'login' },
    Scope: { FULL_NAME: 'full_name', EMAIL: 'email' },
    performRequest: jest.fn(),
  },
  AppleButton,
};

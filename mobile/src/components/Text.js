import { forwardRef } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { FONT_FAMILY } from '../theme.js';

// React Native has no app-wide default font, so every Text/TextInput goes through these wrappers to
// use Be Vietnam Pro like the web. fontWeight still picks the face (registered in the root layout).
export const Text = forwardRef(function Text({ style, ...props }, ref) {
  return <RNText ref={ref} style={[{ fontFamily: FONT_FAMILY }, style]} {...props} />;
});

export const TextInput = forwardRef(function TextInput({ style, ...props }, ref) {
  return <RNTextInput ref={ref} style={[{ fontFamily: FONT_FAMILY }, style]} {...props} />;
});

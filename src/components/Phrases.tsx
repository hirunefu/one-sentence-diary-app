import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

// A line that must wrap (at a large font size) breaks after 「、」, between
// phrases, instead of inside a word.
export function Phrases({
  text,
  style,
  boxStyle,
  align = 'center',
}: {
  text: string;
  style: StyleProp<TextStyle>;
  boxStyle?: StyleProp<ViewStyle>;
  align?: 'center' | 'right';
}) {
  const phrases = text.replace(/、/g, '、\n').split('\n');
  const textAlign = { textAlign: align } as const;
  if (phrases.length === 1) {
    return <Text style={[boxStyle as StyleProp<TextStyle>, style, textAlign]}>{text}</Text>;
  }
  return (
    <View
      style={[
        boxStyle,
        styles.phrases,
        { justifyContent: align === 'center' ? 'center' : 'flex-end' },
      ]}
    >
      {phrases.map((phrase, i) => (
        <Text key={i} style={[style, textAlign]}>
          {phrase}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  phrases: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

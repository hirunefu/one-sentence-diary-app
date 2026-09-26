import React from 'react';
import { StyleSheet } from 'react-native';
import { render, fireEvent, screen, within } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

import { EntryInput } from './EntryInput';

const renderInput = (props: { value?: string; onChangeText?: (text: string) => void } = {}) =>
  render(
    <EntryInput
      value=""
      onChangeText={() => {}}
      label="今日の一文"
      placeholder="今日、助かったことは？"
      {...props}
    />
  );

describe('EntryInput', () => {
  test('shows initial value and remaining count', async () => {
    const { getByDisplayValue, getByText } = await renderInput({ value: 'hello' });
    expect(getByDisplayValue('hello')).toBeTruthy();
    expect(getByText('残り 135 字')).toBeTruthy();
  });

  test('strips newlines from input', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderInput({ onChangeText: onChange });
    await fireEvent.changeText(getByTestId('entry-input'), 'a\nb\rc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  test('blocks input beyond 140 codepoints', async () => {
    const onChange = jest.fn();
    const longText = 'a'.repeat(140);
    const { getByTestId } = await renderInput({ value: longText, onChangeText: onChange });
    await fireEvent.changeText(getByTestId('entry-input'), longText + 'b');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('counts emoji as 1 in remaining count', async () => {
    const { getByText } = await renderInput({ value: '😀😀😀' });
    expect(getByText('残り 137 字')).toBeTruthy();
  });

  test('allows input that fits exactly at the limit', async () => {
    const onChange = jest.fn();
    const { getByTestId } = await renderInput({ onChangeText: onChange });
    const text = 'a'.repeat(140);
    await fireEvent.changeText(getByTestId('entry-input'), text);
    expect(onChange).toHaveBeenCalledWith(text);
  });

  // TalkBack reads an EditText's contentDescription instead of what is written
  // in it (or of the Prompt), so the name comes from a label on screen.
  test('the field is named by its visible label, not by an invisible one', async () => {
    await renderInput();
    const input = screen.getByTestId('entry-input');
    const label = screen.getByText('今日の一文');
    expect(input).toHaveAccessibleName('今日の一文');
    expect(input.props.accessibilityLabelledBy).toBe(label.props.nativeID);
    expect(input.props.accessibilityLabel).toBeUndefined();
    expect(screen.getByPlaceholderText('今日、助かったことは？')).toBe(input);
  });

  // Home stays mounted under the Backfill editor, and a label is found by the
  // first view with its id.
  test('two fields on screen are each named by their own label', async () => {
    await render(
      <>
        <EntryInput value="" onChangeText={() => {}} label="今日の一文" placeholder="a？" />
        <EntryInput value="" onChangeText={() => {}} label="5月14日の一文" placeholder="b？" />
      </>
    );
    expect(screen.getByPlaceholderText('a？')).toHaveAccessibleName('今日の一文');
    expect(screen.getByPlaceholderText('b？')).toHaveAccessibleName('5月14日の一文');
  });

  // Android draws a placeholder at the font's own line spacing and clips it to
  // the height measured at the Entry's; so the Prompt is drawn as text, once.
  test('the Prompt is drawn while the field is empty, and only once', async () => {
    const onChange = jest.fn();
    const view = await renderInput({ onChangeText: onChange });
    const drawn = screen.getByTestId('entry-prompt', { includeHiddenElements: true });
    expect(drawn).toHaveTextContent('今日、助かったことは？');
    // At the Entry's own size and line spacing, breaking after 「、」.
    const { fontSize, lineHeight } = StyleSheet.flatten(
      screen.getByTestId('entry-input').props.style
    );
    const phrases = within(drawn).getAllByText(/./, { includeHiddenElements: true });
    expect(phrases.map((p) => p.props.children)).toEqual(['今日、', '助かったことは？']);
    for (const phrase of phrases) expect(phrase).toHaveStyle({ fontSize, lineHeight });
    // Screen readers hear it from the field's placeholder, not twice.
    expect(screen.queryByTestId('entry-prompt')).toBeNull();
    expect(screen.getByTestId('entry-input').props.placeholderTextColor).toBe('transparent');

    await view.rerender(
      <EntryInput value="川" onChangeText={onChange} label="今日の一文" placeholder="今日、助かったことは？" />
    );
    expect(screen.queryByTestId('entry-prompt', { includeHiddenElements: true })).toBeNull();
  });

  // Home keeps its optional lines out of what the field needs (utils/room).
  test('reports the whole Prompt as needed while empty, and one line once written', async () => {
    const onNeed = jest.fn();
    const layout = (height: number) => ({ nativeEvent: { layout: { x: 0, y: 0, width: 300, height } } });
    const view = await render(
      <EntryInput value="" onChangeText={() => {}} label="今日の一文" placeholder="今日、助かったことは？" onNeedHeight={onNeed} />
    );
    const hidden = { includeHiddenElements: true };
    await fireEvent(screen.getByTestId('entry-label-row', hidden), 'layout', layout(20));
    await fireEvent(screen.getByTestId('entry-prompt', hidden), 'layout', layout(75));
    await fireEvent(screen.getByTestId('entry-line-sizer', hidden), 'layout', layout(37));
    expect(onNeed).toHaveBeenLastCalledWith(20 + 6 + 75);

    await view.rerender(
      <EntryInput value="川" onChangeText={() => {}} label="今日の一文" placeholder="今日、助かったことは？" onNeedHeight={onNeed} />
    );
    expect(onNeed).toHaveBeenLastCalledWith(20 + 6 + 37);
  });
});


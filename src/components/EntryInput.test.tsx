import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';

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

  // TalkBack names an EditText by its text, or by its placeholder while it is
  // empty, and not by its contentDescription; so the name comes from a label
  // that stays on screen (labelFor) once the Prompt has gone.
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
});

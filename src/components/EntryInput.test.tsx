import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';

jest.mock('../theme/useColors', () => {
  const { lightColors } = require('../theme/colors');
  return {
    useColors: () => lightColors,
    useIsDark: () => false,
  };
});

import { EntryInput } from './EntryInput';

describe('EntryInput', () => {
  test('shows initial value and remaining count', () => {
    const { getByDisplayValue, getByText } = render(
      <EntryInput value="hello" onChangeText={() => {}} />
    );
    expect(getByDisplayValue('hello')).toBeTruthy();
    expect(getByText('残り 135 字')).toBeTruthy();
  });

  test('strips newlines from input', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <EntryInput value="" onChangeText={onChange} />
    );
    fireEvent.changeText(getByTestId('entry-input'), 'a\nb\rc');
    expect(onChange).toHaveBeenCalledWith('abc');
  });

  test('blocks input beyond 140 codepoints', () => {
    const onChange = jest.fn();
    const longText = 'a'.repeat(140);
    const { getByTestId } = render(
      <EntryInput value={longText} onChangeText={onChange} />
    );
    fireEvent.changeText(getByTestId('entry-input'), longText + 'b');
    expect(onChange).not.toHaveBeenCalled();
  });

  test('counts emoji as 1 in remaining count', () => {
    const { getByText } = render(
      <EntryInput value="😀😀😀" onChangeText={() => {}} />
    );
    expect(getByText('残り 137 字')).toBeTruthy();
  });

  test('allows input that fits exactly at the limit', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <EntryInput value="" onChangeText={onChange} />
    );
    const text = 'a'.repeat(140);
    fireEvent.changeText(getByTestId('entry-input'), text);
    expect(onChange).toHaveBeenCalledWith(text);
  });
});

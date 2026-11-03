import React, { useRef, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable, StyleSheet, ViewStyle, TextStyle, TextInputProps,
} from 'react-native';
import { Colors, Radius, Spacing } from '@/theme';

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  secureTextEntry?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  keyboardType?: TextInputProps['keyboardType'];
  maxLength?: number;
  textContentType?: TextInputProps['textContentType'];
  multiline?: boolean;
  numberOfLines?: number;
  rightIcon?: React.ReactNode;
  onRightIconPress?: () => void;
  style?: ViewStyle | TextStyle;
  error?: string;
  editable?: boolean;
}

export default function Input({
  label, value, onChangeText, placeholder, secureTextEntry, autoCapitalize,
  autoCorrect, keyboardType, multiline, numberOfLines, rightIcon, onRightIconPress,
  style, error, editable = true, maxLength, textContentType,
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);

  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {/* Tapping anywhere in the field focuses the input — bigger, more reliable hit target. */}
      <Pressable
        onPress={() => editable && inputRef.current?.focus()}
        style={[
          styles.inputWrap,
          multiline && styles.inputWrapMulti,
          focused && styles.inputWrapFocused,
          !!error && styles.inputWrapError,
          !editable && styles.inputWrapDisabled,
        ]}
      >
        <TextInput
          ref={inputRef}
          style={[styles.input, multiline && styles.inputMulti, style as TextStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={Colors.gray400}
          secureTextEntry={secureTextEntry}
          autoCapitalize={autoCapitalize ?? 'sentences'}
          autoCorrect={autoCorrect ?? false}
          keyboardType={keyboardType}
          maxLength={maxLength}
          textContentType={textContentType}
          accessibilityLabel={label}
          multiline={multiline}
          numberOfLines={numberOfLines}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          editable={editable}
          selectionColor={Colors.accent}
        />
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon} disabled={!onRightIconPress} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            {rightIcon}
          </TouchableOpacity>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: Spacing.md },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8, color: Colors.inkSecondary, letterSpacing: -0.1 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: Radius.md,
    borderWidth: 1.5, borderColor: Colors.lineStrong,
    paddingHorizontal: 15,
  },
  inputWrapMulti: { alignItems: 'flex-start' },
  inputWrapFocused: {
    borderColor: Colors.accent, backgroundColor: Colors.white,
    shadowColor: Colors.brand, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16, shadowRadius: 10,
  },
  inputWrapError:   { borderColor: Colors.error, backgroundColor: Colors.white },
  inputWrapDisabled:{ opacity: 0.55, backgroundColor: Colors.surface },
  input: { flex: 1, fontSize: 15, color: Colors.ink, paddingVertical: 15, fontWeight: '500' },
  inputMulti: { textAlignVertical: 'top', paddingTop: 12, minHeight: 84 },
  rightIcon: { paddingLeft: 10 },
  error: { fontSize: 12, color: Colors.error, marginTop: 5, fontWeight: '500' },
});

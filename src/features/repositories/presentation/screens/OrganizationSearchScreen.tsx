import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

interface OrganizationSearchScreenProps {
  navigation?: { navigate: (screen: string, params: Record<string, unknown>) => void };
}

/**
 * Assignment §3.1.
 *
 * BUG-006 fix (docs/BUGS.md): this screen previously rendered its own
 * "Public GitHub Explorer" heading as the first element in the body, which
 * duplicated the identical title `RootNavigator` already sets via the
 * native stack header's `options={{ title: 'Public GitHub Explorer' }}`.
 * Dropped the in-body heading and kept the nav bar title, per the bug's
 * "Expected" resolution.
 *
 * BUG-018 fix (docs/BUGS.md): this screen previously also rendered a
 * hardcoded `SUGGESTED_ORGS` list as tappable "Try:" quick-suggestion
 * chips. That was UI the assignment brief never asked for — §2.1 lists
 * `facebook`/`microsoft`/`shopify`/`netflix`/`vercel` only as illustrative
 * examples of a string a user might type into the free-text field, not as
 * a spec for a preset picker. Removed entirely; the free-text input +
 * Search button is the only entry point now, per spec.
 */
export function OrganizationSearchScreen({ navigation }: OrganizationSearchScreenProps) {
  const [org, setOrg] = useState('');

  const goToOrg = (value: string) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    navigation?.navigate('RepositoryList', { org: trimmed });
  };

  return (
    <View style={styles.container}>
      <TextInput
        testID="organization-search-input"
        style={styles.input}
        placeholder="Enter a GitHub organization, e.g. facebook"
        placeholderTextColor="#8E8E93"
        value={org}
        onChangeText={setOrg}
        autoCapitalize="none"
        autoCorrect={false}
        onSubmitEditing={() => goToOrg(org)}
        returnKeyType="search"
      />
      <Pressable
        testID="organization-search-submit"
        accessibilityRole="button"
        accessibilityLabel="Search"
        style={styles.button}
        onPress={() => goToOrg(org)}
      >
        <Text style={styles.buttonText}>Search</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  input: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#C7C7CC',
    fontSize: 16,
    color: '#1C1C1E',
  },
  button: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#0969DA',
    alignItems: 'center',
  },
  buttonText: { color: '#FFFFFF', fontWeight: '600', fontSize: 16 },
});

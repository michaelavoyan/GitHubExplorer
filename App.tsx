/**
 * App entry point. Wires providers (TanStack Query + MMKV offline
 * persister + SafeAreaProvider + connectivity monitoring) around the
 * navigation root, per src/app/'s Architecture.md folder responsibility.
 */

import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { AppProviders } from './src/app/AppProviders';
import { RootNavigator } from './src/app/navigation/RootNavigator';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <AppProviders>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <RootNavigator />
    </AppProviders>
  );
}

export default App;

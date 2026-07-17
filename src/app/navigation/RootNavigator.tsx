import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { OrganizationSearchScreen } from '../../features/repositories/presentation/screens/OrganizationSearchScreen';
import { RepositoryListScreen } from '../../features/repositories/presentation/screens/RepositoryListScreen';
import { RepositoryDetailsScreen } from '../../features/repositories/presentation/screens/RepositoryDetailsScreen';
import { RepositoriesStackParamList } from '../../features/repositories/presentation/navigation/types';
import { OfflineBanner } from '../components/OfflineBanner';

const Stack = createNativeStackNavigator<RepositoriesStackParamList>();

export function RootNavigator() {
  return (
    <NavigationContainer>
      <OfflineBanner />
      <Stack.Navigator initialRouteName="OrganizationSearch">
        <Stack.Screen
          name="OrganizationSearch"
          component={OrganizationSearchScreen}
          options={{ title: 'Public GitHub Explorer' }}
        />
        <Stack.Screen
          name="RepositoryList"
          component={RepositoryListScreen}
          options={({ route }) => ({ title: route.params.org })}
        />
        <Stack.Screen
          name="RepositoryDetails"
          component={RepositoryDetailsScreen}
          options={({ route }) => ({ title: route.params.repo })}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

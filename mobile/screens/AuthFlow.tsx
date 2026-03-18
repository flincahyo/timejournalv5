import * as React from 'react';
import { useState } from 'react';
import { View } from 'react-native';
import LoginScreen from './LoginScreen';
import SignupScreen from './SignupScreen';

export default function AuthFlow({ onLogin }: { onLogin: () => void }) {
  const [currentScreen, setCurrentScreen] = useState<'login' | 'signup'>('login');

  return (
    <View style={{ flex: 1 }}>
      {currentScreen === 'login' ? (
        <LoginScreen onLoginSuccess={onLogin} onRegister={() => setCurrentScreen('signup')} />
      ) : (
        <SignupScreen onBack={() => setCurrentScreen('login')} onRegister={onLogin} />
      )}
    </View>
  );
}

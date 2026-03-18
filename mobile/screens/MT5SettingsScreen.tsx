import React, { useState, useEffect, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Animated, Easing, Dimensions } from 'react-native';
import { useColorScheme } from 'nativewind';
import { ShieldCheck, RefreshCw, Plus, Trash2, ExternalLink, Server, ChevronRight, X, Cpu, Globe } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AILoadingAnimation } from '../components/AILoadingAnimation';
import { API_URL } from '../Constants';

import { useMT5Sync } from '../hooks/useMT5Sync';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function MT5SettingsScreen({ onNavigate }: { onNavigate?: (s: string) => void }) {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

  const { 
    isConnected, account, trades, loading, syncing, lastSync: hookLastSync, triggerSync, refresh 
  } = useMT5Sync();

  const [view, setView] = useState<"list" | "form" | "connecting">("list");
  const [accounts, setAccounts] = useState<any[]>([]);
  const [localActiveAccount, setLocalActiveAccount] = useState<any>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  
  const [form, setForm] = useState({ login: "", password: "", server: "", port: "443" });
  const [errMsg, setErrMsg] = useState("");

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchAccounts();
    Animated.timing(fadeAnim, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, []);

  const fetchAccounts = async () => {
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/accounts`, {
        headers: { Authorization: `Bearer ${jwt}` }
      });
      const rawData = await res.json();
      const accountsList = Array.isArray(rawData.accounts) ? rawData.accounts : (Array.isArray(rawData) ? rawData : []);
      setAccounts(accountsList);
      const active = accountsList.find((a: any) => a.isActive);
      if (active) setLocalActiveAccount(active);
    } catch (e) {
      console.error(e);
    } finally {
      setInitialLoading(false);
    }
  };

  const setF = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleConnect = async () => {
    if (!form.login || !form.password || !form.server) { 
      setErrMsg("Required fields missing."); 
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return; 
    }
    setErrMsg(""); 
    setView("connecting");

    try {
      const jwt = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/mt5/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({
          login: parseInt(form.login),
          password: form.password,
          server: form.server,
          port: parseInt(form.port)
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Connection Failed");

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      await fetchAccounts();
      refresh();
      setTimeout(() => setView("list"), 1500);
    } catch (err: any) {
      setErrMsg(err.message || String(err));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setView("form");
    }
  };

  const handleToggle = async (accId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/mt5/toggle_account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
        body: JSON.stringify({ id: accId })
      });
      await fetchAccounts();
      refresh();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (accId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/mt5/accounts/${accId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${jwt}` }
      });
      fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDisconnect = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    try {
      const jwt = await AsyncStorage.getItem('userToken');
      await fetch(`${API_URL}/mt5/disconnect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${jwt}` }
      });
      refresh();
      await fetchAccounts();
    } catch (e) {
      console.error(e);
    }
  };

  const inp = {
    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.4)' : '#f8fafc',
    borderWidth: 1, borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : '#e2e8f0',
    borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    color: isDark ? '#f8fafc' : '#0f172a', fontSize: 13, marginBottom: 16,
    fontFamily: 'Montserrat_400Regular'
  };

  const lbl = { fontSize: 10, fontWeight: '900' as const, color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase' as const, letterSpacing: 1.5, marginBottom: 8, paddingHorizontal: 4 };

  return (
    <View style={{ flex: 1, backgroundColor: isDark ? '#020617' : '#ffffff' }}>
      <ScrollView 
        style={{ flex: 1 }} 
        contentContainerStyle={{ padding: 24, paddingBottom: 60, paddingTop: 68 }} 
        showsVerticalScrollIndicator={false}
      >
        {/* Modern Header */}
        <View style={{ marginBottom: 32 }}>
            <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#6366f1', textTransform: 'uppercase', letterSpacing: 2, marginBottom: 4 }}>
              Broker Synchronization
            </Text>
            <Text style={{ fontSize: 28, fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: -1 }}>
              Liquidity Bridge
            </Text>
        </View>

        {view === "list" && (
          <Animated.View style={{ opacity: fadeAnim }}>
            {/* Active Account Banner - Premium Rework */}
            {isConnected && account ? (
              <View style={{ 
                backgroundColor: isDark ? 'rgba(16, 185, 129, 0.05)' : '#f0fdf4', 
                borderRadius: 32, padding: 24, marginBottom: 32,
                borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)',
                shadowColor: '#10b981', shadowOpacity: 0.05, shadowRadius: 15
              }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                   <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#10b981' }} />
                      <Text style={{ fontSize: 11, fontWeight: '900', color: '#10b981', textTransform: 'uppercase', letterSpacing: 1.5 }}>Synchronized</Text>
                   </View>
                   <TouchableOpacity 
                     onPress={triggerSync}
                     style={{ width: 40, height: 40, borderRadius: 14, backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : '#ffffff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8 }}
                   >
                     <RefreshCw size={18} color="#10b981" />
                   </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <View>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: isDark ? '#f8fafc' : '#1e293b', fontFamily: 'Montserrat_700Bold' }}>#{account.login}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>{account.server}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: isDark ? '#f8fafc' : '#1e293b' }}>
                      ${account.balance?.toLocaleString() || "0"}
                    </Text>
                    <Text style={{ fontSize: 10, fontWeight: 'bold', color: '#10b981', textTransform: 'uppercase' }}>
                      Equity Match: ${account.equity?.toLocaleString() || "0"}
                    </Text>
                  </View>
                </View>

                <TouchableOpacity 
                  onPress={handleDisconnect}
                  style={{ 
                    marginTop: 24, paddingVertical: 16, borderRadius: 20, 
                    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2', 
                    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.1)'
                  }}
                >
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#ef4444', textTransform: 'uppercase', letterSpacing: 1.5 }}>Inhibit Connection</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ 
                padding: 40, borderRadius: 32, borderWidth: 1, borderStyle: 'dashed', 
                borderColor: isDark ? '#334155' : '#e2e8f0', backgroundColor: isDark ? 'rgba(30, 41, 59, 0.1)' : '#fafafa', 
                alignItems: 'center', marginBottom: 32 
              }}>
                <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: isDark ? '#1e293b' : '#ffffff', alignItems: 'center', justifyContent: 'center', marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10 }}>
                   <Globe size={28} color="#6366f1" />
                </View>
                <Text style={{ fontSize: 18, fontWeight: '900', color: isDark ? '#f8fafc' : '#1e293b', marginBottom: 8 }}>Isolated Intelligence</Text>
                <Text style={{ fontSize: 13, color: '#64748b', textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 }}>
                  Bridge your MT5 account to enable real-time metadata extraction and technical audits.
                </Text>
              </View>
            )}

            {/* Account List - Premium Rework */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 4 }}>
                <Text style={{ fontSize: 11, fontWeight: '900', color: isDark ? '#475569' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 2 }}>Persisted Credentials</Text>
                <TouchableOpacity 
                   onPress={() => { Haptics.selectionAsync(); setView("form"); }}
                   style={{ 
                     flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366f1', 
                     paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
                     shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }
                   }}
                >
                  <Plus size={14} color="#ffffff" strokeWidth={3} />
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase' }}>Initialize</Text>
                </TouchableOpacity>
              </View>

              {loading && <ActivityIndicator color="#6366f1" style={{ marginVertical: 30 }} />}

              {accounts.map(acc => (
                <TouchableOpacity 
                  key={acc.id}
                  activeOpacity={0.8}
                  onPress={() => !acc.isActive && handleToggle(acc.id)}
                  style={{ 
                    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderRadius: 28, marginBottom: 16,
                    backgroundColor: acc.isActive ? (isDark ? '#1e293b' : '#f8fafc') : (isDark ? 'rgba(30, 41, 59, 0.2)' : '#ffffff'),
                    borderWidth: 1, borderColor: acc.isActive ? '#6366f140' : (isDark ? 'rgba(51, 65, 85, 0.4)' : '#f1f5f9'),
                    shadowColor: '#000', shadowOpacity: acc.isActive ? 0.05 : 0, shadowRadius: 10
                  }}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                    <View style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: acc.isActive ? '#6366f115' : (isDark ? '#0f172a' : '#f1f5f9') }}>
                      <ExternalLink size={20} color={acc.isActive ? '#6366f1' : (isDark ? '#475569' : '#94a3b8')} />
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: isDark ? '#f8fafc' : '#1e293b' }}>#{acc.login}</Text>
                        {acc.isActive && <View style={{ backgroundColor: '#10b98115', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 }}><Text style={{ fontSize: 9, fontWeight: '900', color: '#10b981', textTransform: 'uppercase' }}>Active</Text></View>}
                      </View>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#64748b', textTransform: 'uppercase', marginTop: 2 }}>{acc.server}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    {!acc.isActive ? (
                      <TouchableOpacity 
                        onPress={() => handleDelete(acc.id)} 
                        style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ef444408', borderRadius: 12 }}
                      >
                        <Trash2 size={18} color="#ef4444" opacity={0.6} />
                      </TouchableOpacity>
                    ) : (
                      <ChevronRight size={20} color="#6366f1" />
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </Animated.View>
        )}

        {view === "form" && (
          <Animated.View style={{ opacity: fadeAnim }}>
             <View style={{ 
               backgroundColor: 'rgba(99, 102, 241, 0.05)', borderRadius: 24, padding: 20, 
               flexDirection: 'row', gap: 14, marginBottom: 32,
               borderWidth: 1, borderColor: 'rgba(99, 102, 241, 0.15)'
             }}>
                <ShieldCheck size={24} color="#6366f1" />
                <Text style={{ flex: 1, fontSize: 12, color: isDark ? '#94a3b8' : '#475569', lineHeight: 20, fontFamily: 'Montserrat_400Regular' }}>
                  Use your <Text style={{ fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a' }}>INVESTOR PASSWORD</Text> for read-only access. Credentials are encrypted and transmitted via secured tunnel.
                </Text>
             </View>

             {errMsg ? <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' }}>{errMsg}</Text> : null}

             <View>
               <Text style={lbl}>Terminal Account ID</Text>
               <TextInput style={inp} value={form.login} onChangeText={t => setF("login", t)} placeholder="e.g. 50921102" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} keyboardType="number-pad" />
               
               <Text style={lbl}>Access Key (Investor)</Text>
               <TextInput style={inp} value={form.password} onChangeText={t => setF("password", t)} placeholder="••••••••" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} secureTextEntry />
               
               <View style={{ flexDirection: 'row', gap: 12 }}>
                 <View style={{ flex: 3 }}>
                   <Text style={lbl}>Broker Metadata</Text>
                   <TextInput style={inp} value={form.server} onChangeText={t => setF("server", t)} placeholder="ICMarkets-Demo" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} autoCapitalize="none" />
                 </View>
                 <View style={{ flex: 2 }}>
                   <Text style={lbl}>Port</Text>
                   <TextInput style={inp} value={form.port} onChangeText={t => setF("port", t)} placeholder="443" placeholderTextColor={isDark ? '#475569' : '#94a3b8'} keyboardType="number-pad" />
                 </View>
               </View>
             </View>

             <View style={{ flexDirection: 'row', gap: 12, marginTop: 20 }}>
               <TouchableOpacity 
                 onPress={() => { Haptics.selectionAsync(); setView("list"); }}
                 style={{ flex: 1, paddingVertical: 18, borderRadius: 24, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center' }}
               >
                 <Text style={{ fontSize: 13, fontWeight: '900', color: isDark ? '#94a3b8' : '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>Abort</Text>
               </TouchableOpacity>
               <TouchableOpacity 
                 onPress={handleConnect}
                 style={{ 
                   flex: 2, paddingVertical: 18, borderRadius: 24, backgroundColor: '#6366f1', 
                   alignItems: 'center', shadowColor: '#6366f1', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10
                 }}
               >
                 <Text style={{ fontSize: 13, fontWeight: '900', color: '#ffffff', textTransform: 'uppercase', letterSpacing: 1 }}>Establish Bridge</Text>
               </TouchableOpacity>
             </View>
          </Animated.View>
        )}

        {(view === "connecting" || syncing) && (
          <View style={{ height: SCREEN_HEIGHT * 0.6, justifyContent: 'center' }}>
            <AILoadingAnimation 
              isDark={isDark} 
              message={syncing ? "Auditing Portfolio..." : "Establishing Bridge..."} 
              subMessage={syncing ? "Synchronizing your latest trade metadata from the liquidity pool." : "Handshaking with MT5 terminal for secure metadata extraction."}
            />
          </View>
        )}

      </ScrollView>
    </View>
  );
}

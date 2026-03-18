import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, Modal, ScrollView, Image,
  ActivityIndicator, Alert, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { Camera, Image as ImageIcon, X, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BACKEND_URL, API_URL } from '../Constants';

// ── Elegant default avatar presets ────────────────────────────────────────────
// Using DiceBear Notionists-Neutral via URL seeds (styled, gender-neutral)
const PRESET_SEEDS = [
  'felix', 'luna', 'nova', 'atlas', 'sage', 'river',
  'eden', 'orion', 'quinn', 'zara', 'leo', 'aria',
];

const getPresetUrl = (seed: string) =>
  `https://api.dicebear.com/9.x/notionists-neutral/jpg?seed=${seed}&size=128&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`;

// ── Component ──────────────────────────────────────────────────────────────────
interface Props {
  visible: boolean;
  currentImage?: string | null;
  isDark: boolean;
  onClose: () => void;
  onAvatarUpdated: (url: string) => void;
}

export function AvatarPickerModal({ visible, currentImage, isDark, onClose, onAvatarUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const card = isDark ? '#13161f' : '#ffffff';
  const bg = isDark ? '#0b0e11' : '#f5f7fa';
  const border = isDark ? '#1e293b' : '#e8edf5';
  const textP = isDark ? '#f1f5f9' : '#0f172a';
  const textS = isDark ? '#64748b' : '#94a3b8';

  // ── Request camera roll permission ────────────────────────────────────────
  const requestPermission = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access in Settings to upload a photo.');
        return false;
      }
    }
    return true;
  };

  // ── Pick from device + crop square ────────────────────────────────────────
  const handlePickFromDevice = async () => {
    const ok = await requestPermission();
    if (!ok) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,        // Native square crop UI
        aspect: [1, 1],             // Force 1:1 ratio
        quality: 0.85,
        selectionLimit: 1,
      });

      if (result.canceled || !result.assets?.length) return;
      const uri = result.assets[0].uri;

      // Resize + compress to 300x300
      const manipulated = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300, height: 300 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );

      await uploadFile(manipulated.uri);
    } catch (e) {
      console.error('Image pick error:', e);
      Alert.alert('Error', 'Could not open photo library.');
    }
  };

  // ── Upload file to backend ─────────────────────────────────────────────────
  const uploadFile = async (uri: string) => {
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: 'avatar.jpg',
        type: 'image/jpeg',
      } as any);

      const res = await fetch(`${API_URL}/auth/upload-avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (!res.ok) throw new Error('Upload failed');
      const data = await res.json();
      // Backend returns relative url like /uploads/xxx.jpg — make it absolute
      const fullUrl = data.url?.startsWith('http') ? data.url : `${BACKEND_URL}${data.url}`;
      onAvatarUpdated(fullUrl);
      onClose();
    } catch (e) {
      Alert.alert('Upload failed', 'Could not upload image. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  // ── Select a preset ────────────────────────────────────────────────────────
  const handleSelectPreset = async (presetUrl: string) => {
    setSelected(presetUrl);
  };

  // ── Confirm preset selection ───────────────────────────────────────────────
  const handleConfirmPreset = async () => {
    if (!selected) return;
    setUploading(true);
    try {
      const token = await AsyncStorage.getItem('userToken');
      const res = await fetch(`${API_URL}/auth/profile`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: selected }),
      });
      if (!res.ok) throw new Error('Update failed');
      onAvatarUpdated(selected);
      onClose();
    } catch (e) {
      Alert.alert('Error', 'Could not update avatar. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: bg }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
          paddingHorizontal: 20, paddingTop: 52, paddingBottom: 16,
          borderBottomWidth: 1, borderBottomColor: border,
          backgroundColor: card,
        }}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: '900', color: textP, letterSpacing: -0.5 }}>Change Avatar</Text>
            <Text style={{ fontSize: 11, color: textS, marginTop: 1 }}>Choose a preset or upload your own</Text>
          </View>
          <TouchableOpacity
            onPress={onClose}
            style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isDark ? '#1e293b' : '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={16} color={textS} strokeWidth={2} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20 }} showsVerticalScrollIndicator={false}>
          {/* Current avatar preview */}
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <View style={{ position: 'relative' }}>
              {(selected || currentImage) ? (
                <Image
                  source={{ uri: selected || currentImage! }}
                  style={{ width: 96, height: 96, borderRadius: 48, borderWidth: 3, borderColor: '#6366f1' }}
                />
              ) : (
                <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: '#6366f1' }}>
                  <Text style={{ fontSize: 36, fontWeight: '900', color: '#fff' }}>T</Text>
                </View>
              )}
              {selected && (
                <View style={{ position: 'absolute', bottom: 0, right: 0, width: 26, height: 26, borderRadius: 13, backgroundColor: '#10b981', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: bg }}>
                  <Check size={13} color="#fff" strokeWidth={3} />
                </View>
              )}
            </View>
            <Text style={{ fontSize: 11, color: textS, marginTop: 8 }}>Preview</Text>
          </View>

          {/* Upload from device */}
          <Text style={{ fontSize: 9, fontWeight: '900', color: textS, letterSpacing: 1.5, marginBottom: 10 }}>UPLOAD FROM DEVICE</Text>
          <TouchableOpacity
            onPress={handlePickFromDevice}
            disabled={uploading}
            style={{
              flexDirection: 'row', alignItems: 'center', gap: 12,
              backgroundColor: card, borderRadius: 18, padding: 16,
              borderWidth: 1, borderColor: border, marginBottom: 28,
            }}
          >
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: isDark ? '#1e293b' : '#eef2ff', alignItems: 'center', justifyContent: 'center' }}>
              <ImageIcon size={20} color="#6366f1" strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 14, fontWeight: '800', color: textP }}>Photo Library</Text>
              <Text style={{ fontSize: 11, color: textS, marginTop: 1 }}>Auto-cropped to circle · 1:1 ratio</Text>
            </View>
            {uploading && <ActivityIndicator size="small" color="#6366f1" />}
          </TouchableOpacity>

          {/* Preset avatars */}
          <Text style={{ fontSize: 9, fontWeight: '900', color: textS, letterSpacing: 1.5, marginBottom: 10 }}>DEFAULT AVATARS</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            {PRESET_SEEDS.map(seed => {
              const url = getPresetUrl(seed);
              const isSelected = selected === url;
              return (
                <TouchableOpacity
                  key={seed}
                  onPress={() => handleSelectPreset(url)}
                  disabled={uploading}
                  style={{
                    borderRadius: 40, borderWidth: 3,
                    borderColor: isSelected ? '#6366f1' : 'transparent',
                    padding: isSelected ? 2 : 2,
                  }}
                >
                  <Image
                    source={{ uri: url }}
                    style={{ width: 64, height: 64, borderRadius: 32 }}
                  />
                  {isSelected && (
                    <View style={{
                      position: 'absolute', bottom: 0, right: 0,
                      width: 20, height: 20, borderRadius: 10,
                      backgroundColor: '#6366f1', alignItems: 'center', justifyContent: 'center',
                      borderWidth: 2, borderColor: bg
                    }}>
                      <Check size={10} color="#fff" strokeWidth={3} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Confirm preset button */}
          {selected && (
            <TouchableOpacity
              onPress={handleConfirmPreset}
              disabled={uploading}
              style={{
                backgroundColor: '#6366f1', borderRadius: 18, paddingVertical: 16,
                alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8,
                shadowColor: '#6366f1', shadowOpacity: 0.3, shadowRadius: 10, elevation: 4,
              }}
            >
              {uploading
                ? <ActivityIndicator size="small" color="#fff" />
                : <Check size={16} color="#fff" strokeWidth={3} />}
              <Text style={{ fontSize: 15, fontWeight: '900', color: '#fff' }}>
                {uploading ? 'Saving...' : 'Use This Avatar'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

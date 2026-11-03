import { Alert, Linking } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

async function hasMediaLibraryAccess() {
  let permission = await ImagePicker.getMediaLibraryPermissionsAsync();
  if (permission.granted || permission.accessPrivileges === 'limited') return true;
  if (permission.canAskAgain) permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted || permission.accessPrivileges === 'limited') return true;

  Alert.alert(
    'Photo access is off',
    'Allow photo access in your phone settings to add photos or videos.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
    ],
  );
  return false;
}

export async function pickServiceMedia(allowsMultipleSelection: boolean) {
  if (!(await hasMediaLibraryAccess())) return null;
  return ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images', 'videos'],
    quality: 0.7,
    allowsMultipleSelection,
    selectionLimit: allowsMultipleSelection ? 4 : 1,
    videoMaxDuration: 30,
  });
}

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import { ref, get, set, serverTimestamp } from 'firebase/database';
import { auth, database, isFirebaseConfigured } from './config';
import { UserProfile, UserRole } from '../types';

/**
 * Registers a new user with email, password, display name, and designated role.
 * Writes the initial profile to Realtime Database under `/users/${uid}`.
 */
export async function registerWithFirebase(params: {
  email: string;
  password: string;
  displayName: string;
  role: UserRole;
  deviceId?: string;
  caretakerEmail?: string;
}): Promise<UserProfile> {
  if (!isFirebaseConfigured || !auth || !database) {
    throw new Error('Firebase is not configured. Set environment variables in .env first.');
  }

  const userCredential = await createUserWithEmailAndPassword(
    auth,
    params.email.trim(),
    params.password
  );
  const fbUser = userCredential.user;

  // Set Firebase Auth displayName
  await updateProfile(fbUser, { displayName: params.displayName.trim() });

  const createdAt = Date.now();
  const profileData: Record<string, unknown> = {
    id: fbUser.uid,
    email: fbUser.email,
    name: params.displayName.trim(),
    role: params.role,
    createdAt: serverTimestamp(),
    notifications: {
      sms: true,
      email: true,
      push: true,
    },
  };

  if (params.role === 'user') {
    profileData.deviceId = params.deviceId ? params.deviceId.trim().toUpperCase() : '';
    profileData.caretakerEmail = params.caretakerEmail ? params.caretakerEmail.trim() : '';
    profileData.sensitivity = 'standard';
    profileData.room = 'Unit 1';

    // If deviceId provided, register placeholder in /devices
    if (params.deviceId) {
      const cleanDevId = params.deviceId.trim().toUpperCase();
      const devRef = ref(database, `devices/${cleanDevId}`);
      await set(devRef, {
        deviceId: cleanDevId,
        patientUid: fbUser.uid,
        status: 'not_connected',
        lastSeen: createdAt,
        firmwareVersion: 'Pending telemetry',
      });
    }
  }

  // Persist user record in RTDB
  const userRef = ref(database, `users/${fbUser.uid}`);
  await set(userRef, profileData);

  return {
    id: fbUser.uid,
    name: params.displayName.trim(),
    email: fbUser.email || params.email,
    role: params.role,
    createdAt: createdAt,
    deviceId: params.deviceId,
    caretakerEmail: params.caretakerEmail,
    notifications: {
      sms: true,
      email: true,
      push: true,
    },
  };
}

/**
 * Logs in existing user with email and password.
 */
export async function loginWithFirebase(
  email: string,
  password: string
): Promise<FirebaseUser> {
  if (!isFirebaseConfigured || !auth) {
    throw new Error('Firebase is not configured. Set environment variables in .env first.');
  }

  const result = await signInWithEmailAndPassword(auth, email.trim(), password);
  return result.user;
}

/**
 * Signs out current Firebase session.
 */
export async function logoutFromFirebase(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

/**
 * Subscribes to Firebase Authentication state and resolves user role from RTDB.
 */
export function subscribeToAuthState(
  callback: (user: UserProfile | null, loading: boolean) => void
): () => void {
  const firebaseAuth = auth;
  const firebaseDatabase = database;
  if (!isFirebaseConfigured || !firebaseAuth || !firebaseDatabase) {
    callback(null, false);
    return () => {};
  }

  return onAuthStateChanged(firebaseAuth, async (fbUser) => {
    if (!fbUser) {
      callback(null, false);
      return;
    }

    try {
      const userRef = ref(firebaseDatabase, `users/${fbUser.uid}`);
      const snapshot = await get(userRef);

      if (snapshot.exists()) {
        const val = snapshot.val();
        const profile: UserProfile = {
          id: fbUser.uid,
          name: val.name || fbUser.displayName || 'Monitored User',
          email: fbUser.email || val.email || '',
          role: (val.role as UserRole) || 'user',
          createdAt: val.createdAt,
          deviceId: val.deviceId,
          caretakerName: val.caretakerName,
          caretakerEmail: val.caretakerEmail,
          caretakerUid: val.caretakerUid,
          phone: val.phone,
          emergencyContact: val.emergencyContact,
          sensitivity: val.sensitivity || 'standard',
          room: val.room,
          notifications: val.notifications || { sms: true, email: true, push: true },
        };
        callback(profile, false);
      } else {
        // Fallback profile if database node is pending
        const fallbackProfile: UserProfile = {
          id: fbUser.uid,
          name: fbUser.displayName || 'User',
          email: fbUser.email || '',
          role: 'user',
          createdAt: Date.now(),
        };
        callback(fallbackProfile, false);
      }
    } catch (err) {
      console.error('Error fetching user profile from database:', err);
      callback(null, false);
    }
  });
}

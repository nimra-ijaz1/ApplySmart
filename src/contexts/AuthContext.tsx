import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import { apiFetch } from '../lib/api.ts';

export interface DbUser {
  id: number;
  uid: string;
  email: string;
  fullName: string | null;
  role: 'student' | 'admin' | 'super_admin';
  isActive: boolean;
  onboardingCompleted: boolean;
  avatarUrl: string | null;
}

export interface StudentProfile {
  id: number;
  userId: number;
  fullName: string | null;
  nationality: string | null;
  countryOfResidence: string | null;
  dateOfBirth: string | null;
  phoneNumber: string | null;
  currentOrCompletedDegree: string | null;
  degreeCompleted: boolean | null;
  degreeField: string | null;
  universityName: string | null;
  universityCountry: string | null;
  graduationYear: number | null;
  cgpa: string | null;
  cgpaScale: string | null;
  academicPercentage: string | null;
  completedCourses: string[] | null;
  ieltsOverall: string | null;
  ieltsListening: string | null;
  ieltsReading: string | null;
  ieltsWriting: string | null;
  ieltsSpeaking: string | null;
  toeflScore: number | null;
  duolingoScore: number | null;
  otherLanguageTestName: string | null;
  otherLanguageTestScore: string | null;
  languageTestDate: string | null;
  languageTestValidityDate: string | null;
  desiredDegreeLevel: string | null;
  preferredStudyProgrammes: string[] | null;
  preferredCountries: string[] | null;
  preferredIntake: string | null;
  maxTuitionBudgetUsd: number | null;
  scholarshipPreference: string | null;
  preferredStudyMode: string | null;
}

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  dbUser: DbUser | null;
  profile: StudentProfile | null;
  loading: boolean;
  authError: string | null;
  compareIds: number[];
  toggleCompareProgramme: (programmeId: number) => void;
  clearCompare: () => void;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (name: string, email: string, password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<number[]>([]);

  const syncBackendProfile = useCallback(async () => {
    try {
      const data = await apiFetch<{ user: DbUser; profile: StudentProfile }>('/api/profile');
      setDbUser(data.user);
      setProfile(data.profile);
      setAuthError(null);
    } catch (err) {
      console.error('Failed to sync profile:', err);
      setDbUser(null);
      setProfile(null);
      setAuthError(err instanceof Error ? err.message : 'Unable to sync account.');
    }
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (user) {
        await syncBackendProfile();
      } else {
        setDbUser(null);
        setProfile(null);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [syncBackendProfile]);

  const signInWithGoogle = async () => {
    setAuthError(null);
    await signInWithPopup(auth, googleAuthProvider);
  };

  const signInWithEmail = async (email: string, password: string) => {
    setAuthError(null);
    await signInWithEmailAndPassword(auth, email, password);
  };

  const registerWithEmail = async (name: string, email: string, password: string) => {
    setAuthError(null);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (name.trim()) {
      await updateProfile(cred.user, { displayName: name.trim() });
    }
    await syncBackendProfile();
  };

  const resetPassword = async (email: string) => {
    setAuthError(null);
    await sendPasswordResetEmail(auth, email);
  };

  const logout = async () => {
    await signOut(auth);
    setDbUser(null);
    setProfile(null);
    setAuthError(null);
    setCompareIds([]);
  };

  const toggleCompareProgramme = (programmeId: number) => {
    setCompareIds((prev) => {
      if (prev.includes(programmeId)) return prev.filter((id) => id !== programmeId);
      if (prev.length >= 4) return prev;
      return [...prev, programmeId];
    });
  };

  const clearCompare = () => setCompareIds([]);

  return (
    <AuthContext.Provider
      value={{
        firebaseUser,
        dbUser,
        profile,
        loading,
        authError,
        compareIds,
        toggleCompareProgramme,
        clearCompare,
        signInWithGoogle,
        signInWithEmail,
        registerWithEmail,
        resetPassword,
        logout,
        refreshProfile: syncBackendProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth } from '../config/firebase';

// Admin email for this demo project
const ADMIN_EMAIL = 'sean.roshan.91@gmail.com';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check if current user is admin
  const isAdmin = user?.email === ADMIN_EMAIL;

  useEffect(() => {
    // Subscribe to auth state changes
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<void> => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      // Re-throw with a more user-friendly message
      if (error instanceof Error) {
        const errorCode = (error as { code?: string }).code;
        switch (errorCode) {
          case 'auth/invalid-email':
            throw new Error('Invalid email address.');
          case 'auth/user-disabled':
            throw new Error('This account has been disabled.');
          case 'auth/user-not-found':
            throw new Error('No account found with this email.');
          case 'auth/wrong-password':
            throw new Error('Incorrect password.');
          case 'auth/invalid-credential':
            throw new Error('Invalid email or password.');
          case 'auth/too-many-requests':
            throw new Error('Too many failed attempts. Please try again later.');
          default:
            throw new Error('Failed to sign in. Please try again.');
        }
      }
      throw error;
    }
  };

  const signUp = async (email: string, password: string): Promise<void> => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      // Re-throw with a more user-friendly message
      if (error instanceof Error) {
        const errorCode = (error as { code?: string }).code;
        switch (errorCode) {
          case 'auth/email-already-in-use':
            throw new Error('An account with this email already exists.');
          case 'auth/invalid-email':
            throw new Error('Invalid email address.');
          case 'auth/operation-not-allowed':
            throw new Error('Email/password accounts are not enabled.');
          case 'auth/weak-password':
            throw new Error('Password should be at least 6 characters.');
          default:
            throw new Error('Failed to create account. Please try again.');
        }
      }
      throw error;
    }
  };

  const signOut = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      throw new Error('Failed to sign out. Please try again.');
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    isAdmin,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

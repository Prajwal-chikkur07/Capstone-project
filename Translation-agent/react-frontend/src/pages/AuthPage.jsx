import { useEffect, useRef, useState } from 'react';
import { SignIn, useAuth, useUser } from '@clerk/clerk-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import * as api from '../services/api';

export default function AuthPage() {
  const { isSignedIn, getToken } = useAuth();
  const { user: clerkUser } = useUser();
  const navigate = useNavigate();
  const { login } = useApp();
  const syncedRef = useRef(false);
  const [consent, setConsent] = useState(false);
  const consentRef = useRef(false);

  // Keep ref in sync so syncUserToBackend always has latest value
  useEffect(() => { consentRef.current = consent; }, [consent]);

  useEffect(() => {
    if (isSignedIn && clerkUser && !syncedRef.current) {
      syncedRef.current = true;
      syncUserToBackend();
    }
  }, [isSignedIn, clerkUser]);

  const syncUserToBackend = async () => {
    try {
      const token = await getToken();
      if (!token) throw new Error('Failed to get Clerk authentication token');
      api.setAuthToken(token);
      const response = await api.syncUser({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress,
        first_name: clerkUser.firstName,
        last_name: clerkUser.lastName,
        avatar_url: clerkUser.imageUrl,
        consent_given: consentRef.current,
      });
      login({
        id: response.id,
        email: response.email,
        firstName: response.first_name,
        lastName: response.last_name,
        consentGiven: response.consent_given,
      });
      navigate('/app');
    } catch (error) {
      console.error('Failed to sync user:', error);
      login({
        id: clerkUser.id,
        email: clerkUser.primaryEmailAddress?.emailAddress || clerkUser.emailAddresses[0]?.emailAddress,
        firstName: clerkUser.firstName,
        lastName: clerkUser.lastName,
        consentGiven: consentRef.current,
      });
      navigate('/app');
    }
  };

  return (
    <div className="min-h-screen flex bg-[#faf8f4]">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between w-[480px] bg-[#1a0f00] px-12 py-12 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-9 h-9 rounded-full object-cover" />
          <span className="text-white font-bold text-[16px] tracking-tight">SeedlingSpeaks</span>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-[#c9a84c] uppercase tracking-widest mb-6">What you can do</p>
          {[
            'Transcribe speech in 10 Indian languages',
            'Translate to any native language instantly',
            'Rewrite in Email, Slack, LinkedIn tones',
            'Send directly to your channels',
            'Vision translate from photos',
            'Continuous hands-free listening',
          ].map(item => (
            <div key={item} className="flex items-start gap-3 mb-4">
              <div className="w-5 h-5 rounded-full bg-[#c9a84c]/20 flex items-center justify-center shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-[#c9a84c]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-[14px] text-white/60 leading-relaxed">{item}</p>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-white/20">Powered by Seedlinglabs · v2.5</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-4 md:px-6 py-12">
        <div className="w-full max-w-[400px]">
          {/* Logo (mobile) */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <img src="/seedlinglabs-logo.png" alt="Seedlinglabs" className="w-8 h-8 rounded-full object-cover" />
            <span className="text-[15px] font-bold text-[#1a0f00]">SeedlingSpeaks</span>
          </div>

          {/* Clerk Sign-In Component */}
          <SignIn
            appearance={{
              elements: {
                rootBox: "w-full",
                card: "shadow-none border-none bg-transparent",
                headerTitle: "text-[20px] md:text-[26px] font-extrabold text-[#1a0f00]",
                headerSubtitle: "text-[14px] text-gray-400 mb-8",
                formButtonPrimary: "bg-[#1a0f00] hover:bg-[#2d1a00] text-white rounded-xl py-3 font-bold",
                formFieldInput: "rounded-xl border-gray-200 focus:border-[#c9a84c]",
                footerActionLink: "text-[#8a5c2e] hover:underline",
              },
              variables: {
                colorPrimary: "#1a0f00",
                colorInputBackground: "#ffffff",
              },
            }}
            redirectUrl="/app"
            signUpUrl="/auth?mode=signup"
          />

          {/* GDPR Consent */}
          <div className="mt-4 flex items-start gap-3 px-1">
            <input
              id="gdpr-consent"
              type="checkbox"
              checked={consent}
              onChange={e => setConsent(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 accent-[#1a0f00] cursor-pointer shrink-0"
            />
            <label htmlFor="gdpr-consent" className="text-[12px] text-gray-500 leading-relaxed cursor-pointer">
              I agree to the use of my data to improve translation quality and personalization. I can withdraw my consent at any time.{' '}
              <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                className="text-[#8a5c2e] underline underline-offset-2 hover:text-[#1a0f00] transition-colors">
                Privacy Policy
              </a>
            </label>
          </div>
          <p className="text-[11px] text-gray-400 mt-2 px-1">
            Consent is optional — you can use the app without it.
          </p>
        </div>
      </div>
    </div>
  );
}

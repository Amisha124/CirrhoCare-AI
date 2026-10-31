import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowRight,
  BrainCircuit,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Database,
  Dna,
  FileText,
  FlaskConical,
  Globe,
  HeartPulse,
  HelpCircle,
  Layers,
  Lock,
  Mail,
  Menu,
  Phone,
  Play,
  Shield,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  User,
  UserCheck,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/AuthContext';
import { useLanguage } from '@/app/LanguageContext';
import { Button } from '@/components/common/Button';

export const LandingPage: React.FC = () => {
  const { isAuthenticated, user } = useAuth();
  const { language, setLanguage, isHindi, t } = useLanguage();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [demoModalOpen, setDemoModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [activeDemoTab, setActiveDemoTab] = useState<'hepatologist' | 'lab' | 'patient' | 'admin'>('hepatologist');

  const getDashboardRoute = () => {
    if (!user) return '/admin';
    if (user.role === 'admin') return '/admin';
    if (user.role === 'hepatologist') return '/doctor';
    if (user.role === 'patient') return '/patient';
    return '/lab';
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div id="home" className="min-h-screen bg-[#F8FAFC] flex flex-col text-slate-900 selection:bg-blue-600 selection:text-white font-sans antialiased">
      {/* =========================================================================
          2. HEADER AND NAVIGATION
          Clean white navigation bar matching the reference image.
          ========================================================================= */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Logo & Tagline */}
          <Link to="/" className="flex items-center gap-3 group shrink-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#1877F2] via-[#2563EB] to-[#4F46E5] flex items-center justify-center text-white shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform duration-200">
              <HeartPulse className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-1.5 leading-none font-manrope">
                CirrhoCare <span className="text-[#1877F2] font-black text-xs px-1.5 py-0.5 rounded bg-blue-50 border border-blue-200">AI</span>
              </span>
              <span className="text-[13px] font-semibold text-slate-500 tracking-normal mt-0.5">
                {t('Smarter Liver Health', 'स्मार्ट लिवर स्वास्थ्य')}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-2 text-[15px] sm:text-[16px] font-semibold text-slate-600">
            <button
              onClick={() => scrollToSection('home')}
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('Home', 'होम')}
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('About', 'परिचय')}
            </button>
            <button
              onClick={() => scrollToSection('platform')}
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('Our Platform', 'हमारा प्लेटफ़ॉर्म')}
            </button>
            <Link
              to="/doctor"
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('For Clinicians', 'चिकित्सकों के लिए')}
            </Link>
            <Link
              to="/lab"
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('For Laboratories', 'प्रयोगशालाओं के लिए')}
            </Link>
            <Link
              to="/patient"
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('For Patients', 'रोगियों के लिए')}
            </Link>

            {/* Resources Dropdown */}
            <div className="relative">
              <button
                onClick={() => setResourcesOpen(!resourcesOpen)}
                onBlur={() => setTimeout(() => setResourcesOpen(false), 200)}
                className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition inline-flex items-center gap-1"
                aria-expanded={resourcesOpen}
              >
                <span>{t('Resources', 'संसाधन')}</span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${resourcesOpen ? 'rotate-180 text-blue-600' : 'text-slate-400'}`} />
              </button>

              {resourcesOpen && (
                <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 py-2.5 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3 py-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    {t('Clinical & Technical Docs', 'नैदानिक ​​एवं तकनीकी दस्तावेज़')}
                  </div>
                  <button
                    onClick={() => { setResourcesOpen(false); setDemoModalOpen(true); }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/70 hover:text-blue-700 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                  >
                    <BrainCircuit className="w-4 h-4 text-blue-600" />
                    <div>
                      <p className="leading-tight">{t('Interactive Platform Tour', 'इंटरैक्टिव प्लेटफ़ॉर्म टूर')}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{t('Explore all 4 clinical workspaces', 'सभी 4 नैदानिक ​​वर्कस्पेस का अन्वेषण करें')}</p>
                    </div>
                  </button>
                  <a
                    href="#how-it-works"
                    onClick={() => { setResourcesOpen(false); scrollToSection('how-it-works'); }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/70 hover:text-blue-700 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                  >
                    <Layers className="w-4 h-4 text-purple-600" />
                    <div>
                      <p className="leading-tight">{t('Workflow & AI Architecture', 'वर्कफ़्लो और एआई आर्किटेक्चर')}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{t('5-step collaborative pathway', '5-चरणीय सहयोगात्मक मार्ग')}</p>
                    </div>
                  </a>
                  <button
                    onClick={() => { setResourcesOpen(false); setContactModalOpen(true); }}
                    className="w-full text-left px-3 py-2 hover:bg-blue-50/70 hover:text-blue-700 text-xs font-semibold text-slate-700 flex items-center gap-2.5 transition"
                  >
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <div>
                      <p className="leading-tight">{t('Security & Role Protection', 'सुरक्षा एवं भूमिका संरक्षण')}</p>
                      <p className="text-[10px] text-slate-400 font-normal">{t('Role-based access & encryption', 'भूमिका-आधारित एक्सेस एवं एन्क्रिप्शन')}</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => setContactModalOpen(true)}
              className="px-3 py-2 rounded-lg hover:text-[#1877F2] hover:bg-slate-50 transition"
            >
              {t('Contact', 'संपर्क')}
            </button>
          </nav>

          {/* Right: Language Switcher & Sign In */}
          <div className="flex items-center gap-3">
            {/* English / हिंदी language switcher */}
            <div className="inline-flex items-center p-0.5 rounded-full bg-slate-100 border border-slate-200/90 text-xs font-bold text-slate-600">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1 rounded-full transition-all duration-150 ${
                  !isHindi
                    ? 'bg-white text-[#1877F2] shadow-xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="Switch to English"
              >
                English
              </button>
              <button
                type="button"
                onClick={() => setLanguage('hi')}
                className={`px-2.5 py-1 rounded-full transition-all duration-150 font-devanagari ${
                  isHindi
                    ? 'bg-white text-[#1877F2] shadow-xs font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
                title="हिंदी में बदलें"
              >
                हिंदी
              </button>
            </div>

            {/* Sign In Button */}
            <Link to="/login">
              <Button
                variant="primary"
                size="md"
                className="bg-[#1877F2] hover:bg-blue-700 text-white shadow-sm font-semibold text-[15px] px-5 py-2.5 rounded-xl"
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                {t('Sign In', 'साइन इन')}
              </Button>
            </Link>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-white border-b border-slate-200 px-6 py-4 space-y-2 animate-in slide-in-from-top duration-150">
            <button
              onClick={() => scrollToSection('home')}
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('Home', 'होम')}
            </button>
            <button
              onClick={() => scrollToSection('about')}
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('About', 'परिचय')}
            </button>
            <button
              onClick={() => scrollToSection('platform')}
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('Our Platform', 'हमारा प्लेटफ़ॉर्म')}
            </button>
            <Link
              to="/doctor"
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('For Clinicians', 'चिकित्सकों के लिए')}
            </Link>
            <Link
              to="/lab"
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('For Laboratories', 'प्रयोगशालाओं के लिए')}
            </Link>
            <Link
              to="/patient"
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('For Patients', 'रोगियों के लिए')}
            </Link>
            <button
              onClick={() => { setMobileMenuOpen(false); setDemoModalOpen(true); }}
              className="block w-full text-left py-2 text-sm font-semibold text-blue-600"
            >
              {t('Watch Demo Tour', 'डेमो टूर देखें')}
            </button>
            <button
              onClick={() => { setMobileMenuOpen(false); setContactModalOpen(true); }}
              className="block w-full text-left py-2 text-sm font-semibold text-slate-700 hover:text-[#1877F2]"
            >
              {t('Contact Us', 'संपर्क करें')}
            </button>
          </div>
        )}
      </header>

      {/* =========================================================================
          3. HERO SECTION
          Recreate the hero section with a light-blue healthcare technology background.
          ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#EFF6FF] via-[#E8F2FE] to-[#F8FAFC] pt-12 pb-16 lg:pt-16 lg:pb-24 border-b border-blue-100/60">
        {/* Subtle decorative background light accents */}
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-blue-300/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 left-10 w-80 h-80 bg-indigo-200/25 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-8 items-center">
            {/* Left Column (5 Cols) */}
            <div className="lg:col-span-6 space-y-6">
              {/* Small Badge */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-blue-200/90 text-[#1877F2] text-xs font-bold shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#1877F2] animate-pulse" />
                <span>
                  {t(
                    'AI-Powered • Secure • Integrated • Patient-Centered',
                    'एआई-संचालित • सुरक्षित • एकीकृत • रोगी-केंद्रित'
                  )}
                </span>
              </div>

              {/* Main Heading */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-slate-900 leading-[1.12]">
                {t('Smarter Insights for Healthier Livers.', 'स्वस्थ लिवर के लिए बेहतर अंतर्दृष्टि।')}
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal max-w-xl">
                {t(
                  'CirrhoCare AI is an integrated clinical platform that connects hepatologists, laboratory teams, administrators and patients to enable early risk insights, coordinated care and better liver health outcomes.',
                  'CirrhoCare AI एक एकीकृत नैदानिक ​​मंच है जो हेपेटोलॉजिस्ट, प्रयोगशाला टीमों, व्यवस्थापकों और रोगियों को जोड़ता है ताकि प्रारंभिक जोखिम अंतर्दृष्टि, समन्वित देखभाल और बेहतर लिवर स्वास्थ्य परिणाम सक्षम हो सकें।'
                )}
              </p>

              {/* Primary & Secondary Action Buttons */}
              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link to="/login">
                  <Button
                    variant="primary"
                    size="lg"
                    className="bg-[#1877F2] hover:bg-blue-700 text-white font-bold text-sm px-6 py-3.5 rounded-xl shadow-md shadow-blue-500/25 flex items-center gap-2"
                  >
                    <span>{t('Get Started', 'शुरू करें')}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </Link>

                <button
                  type="button"
                  onClick={() => setDemoModalOpen(true)}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 font-bold text-sm border border-slate-200/90 shadow-xs hover:border-blue-300 transition-all duration-150"
                >
                  <div className="w-6 h-6 rounded-full bg-blue-50 text-[#1877F2] flex items-center justify-center">
                    <Play className="w-3 h-3 fill-current ml-0.5" />
                  </div>
                  <span>{t('Watch Demo', 'डेमो देखें')}</span>
                </button>
              </div>

              {/* Quick Trust Highlights */}
              <div className="pt-4 flex flex-wrap items-center gap-6 text-xs text-slate-500 font-medium">
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('Random Forest Biomarker Analysis', 'रैंडम फ़ॉरेस्ट बायोमार्कर विश्लेषण')}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{t('Verified 4-Role Architecture', 'सत्यापित 4-भूमिका वास्तुकला')}</span>
                </div>
              </div>
            </div>

            {/* Center/Right Column: Liver Hologram Illustration & Quote Card (7 Cols) */}
            <div className="lg:col-span-6 flex flex-col sm:flex-row lg:flex-row items-center justify-center gap-5">
              {/* Hologram Card Container */}
              <div className="relative w-full max-w-md sm:max-w-xs md:max-w-sm lg:max-w-md rounded-3xl overflow-hidden shadow-2xl border-2 border-white/80 bg-white/70 backdrop-blur-md transition-transform duration-300 hover:scale-[1.01]">
                <div className="aspect-[4/3] w-full relative overflow-hidden bg-slate-900">
                  <img
                    src="/assets/homepage_liver_hologram.jpg"
                    alt="Liver Hologram Illustration and AI Medical Data Panels"
                    className="w-full h-full object-cover object-center"
                  />
                  {/* Hologram Overlay Vignette & Digital Grid Accents */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

                  {/* Live Interactive Telemetry Tag */}
                  <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md border border-cyan-400/40 text-[10px] font-bold text-cyan-300 flex items-center gap-1.5 shadow-md">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    <span>{t('AI LIVER SURVEILLANCE', 'एआई लिवर निगरानी')}</span>
                  </div>
                </div>

                {/* Sub-bar below hologram */}
                <div className="px-5 py-3.5 bg-white/95 border-t border-slate-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-blue-600" />
                    <span className="font-bold text-slate-800">
                      {t('Multivariate Biomarker Inference', 'मल्टीवेरिएट बायोमार्कर निष्कर्ष')}
                    </span>
                  </div>
                  <span className="text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                    {t('Active', 'सक्रिय')}
                  </span>
                </div>
              </div>

              {/* Quote Card on the Right matching Reference Image */}
              <div className="w-full sm:w-56 shrink-0 bg-[#FFFDF0] border border-amber-200/80 rounded-2xl p-5 shadow-md shadow-amber-900/5 relative">
                <div className="w-2 h-2 rounded-full bg-amber-400 mb-3" />
                <p className="text-sm font-bold text-slate-900 leading-snug tracking-tight">
                  {t(
                    '"Advanced Technology for Healthier Tomorrows."',
                    '"स्वस्थ कल के लिए उन्नत तकनीक।"'
                  )}
                </p>
                <div className="mt-3 pt-3 border-t border-amber-200/60">
                  <p className="text-[11px] font-semibold text-amber-900/80">
                    {t('— CirrhoCare AI Healthcare Vision', '— CirrhoCare AI स्वास्थ्य सेवा दृष्टिकोण')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          4. FOUR ROLE-BASED PLATFORM CARDS
          Below the hero section, create four horizontal cards matching the reference.
          ========================================================================= */}
      <section id="platform" className="py-14 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-black uppercase tracking-wider text-[#1877F2]">
              {t('Role-Based Workspaces', 'भूमिका-आधारित कार्यक्षेत्र')}
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1">
              {t('Connected Portals for the Care Team', 'देखभाल दल के लिए एकीकृत पोर्टल')}
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* For Hepatologists */}
            <div className="group bg-[#F8FAFC] hover:bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-purple-200 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <Stethoscope className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  {t('For Hepatologists', 'हेपेटोलॉजिस्ट के लिए')}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t(
                    'Access patient data, AI insights and manage clinical care efficiently.',
                    'रोगी डेटा, एआई अंतर्दृष्टि तक पहुंचें और नैदानिक ​​देखभाल का कुशलतापूर्वक प्रबंधन करें।'
                  )}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-700">
                  {t('Clinical Portal', 'क्लीनिकल पोर्टल')}
                </span>
                <Link
                  to="/doctor"
                  className="w-8 h-8 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-600 hover:text-white flex items-center justify-center transition-colors"
                  aria-label="Open Hepatologist Portal"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* For Laboratories */}
            <div className="group bg-[#F8FAFC] hover:bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-teal-200 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <FlaskConical className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  {t('For Laboratories', 'प्रयोगशालाओं के लिए')}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t(
                    'Record and manage lab results with streamlined and secure workflows.',
                    'सुव्यवस्थित और सुरक्षित वर्कफ़्लो के साथ प्रयोगशाला परिणामों को रिकॉर्ड और प्रबंधित करें।'
                  )}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-teal-700">
                  {t('Lab Workspace', 'लैब कार्यक्षेत्र')}
                </span>
                <Link
                  to="/lab"
                  className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 hover:bg-teal-600 hover:text-white flex items-center justify-center transition-colors"
                  aria-label="Open Laboratory Portal"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* For Patients */}
            <div className="group bg-[#F8FAFC] hover:bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-rose-200 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <HeartPulse className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  {t('For Patients', 'रोगियों के लिए')}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t(
                    'View your reports, appointments and health information in one place.',
                    'अपनी रिपोर्ट, अपॉइंटमेंट और स्वास्थ्य जानकारी एक ही स्थान पर देखें।'
                  )}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-700">
                  {t('Patient Portal', 'रोगी पोर्टल')}
                </span>
                <Link
                  to="/patient"
                  className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white flex items-center justify-center transition-colors"
                  aria-label="Open Patient Portal"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* For Administrators */}
            <div className="group bg-[#F8FAFC] hover:bg-white rounded-3xl p-6 border border-slate-200/90 hover:border-blue-200 shadow-xs hover:shadow-xl transition-all duration-200 flex flex-col justify-between">
              <div>
                <div className="w-12 h-12 rounded-2xl bg-blue-50 text-[#1877F2] flex items-center justify-center mb-5 group-hover:scale-110 transition-transform">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2">
                  {t('For Administrators', 'व्यवस्थापकों के लिए')}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t(
                    'Manage users, monitor system activity and ensure secure operations.',
                    'उपयोगकर्ताओं को प्रबंधित करें, सिस्टम गतिविधि की निगरानी करें और सुरक्षित संचालन सुनिश्चित करें।'
                  )}
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-200/60 flex items-center justify-between">
                <span className="text-[11px] font-bold text-blue-700">
                  {t('Admin Console', 'व्यवस्थापक कंसोल')}
                </span>
                <Link
                  to="/admin"
                  className="w-8 h-8 rounded-full bg-blue-100 text-[#1877F2] hover:bg-[#1877F2] hover:text-white flex items-center justify-center transition-colors"
                  aria-label="Open Admin Dashboard"
                >
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          5. PLATFORM STATISTICS SECTION
          Recreate the horizontal statistics strip with icons and dividers.
          ========================================================================= */}
      <section className="bg-slate-50 border-b border-slate-200/80 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-6 md:gap-4 divide-y md:divide-y-0 md:divide-x divide-slate-200/80">
            {/* Item 1: Patients Supported */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100/80 text-blue-700 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">8+</p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {t('Patients Supported', 'मरीज़ समर्थित')}
                </p>
              </div>
            </div>

            {/* Item 2: Clinical Experts */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-4">
              <div className="w-10 h-10 rounded-2xl bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {t('Clinical Experts', 'नैदानिक ​​विशेषज्ञ')}
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {t('Hepatology Specialists', 'हेपेटोलॉजी विशेषज्ञ')}
                </p>
              </div>
            </div>

            {/* Item 3: Laboratory Teams */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-4">
              <div className="w-10 h-10 rounded-2xl bg-teal-100/80 text-teal-700 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {t('Laboratory Teams', 'प्रयोगशाला टीमें')}
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {t('Connected Diagnostics', 'एकीकृत परीक्षण')}
                </p>
              </div>
            </div>

            {/* Item 4: Secure & Reliable */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-4">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5" />
              </div>
              <div>
                <p className="text-lg font-black text-slate-900 leading-none">
                  {t('Secure & Reliable', 'सुरक्षित और विश्वसनीय')}
                </p>
                <p className="text-xs font-semibold text-slate-600 mt-1">
                  {t('Role-Protected Data', 'भूमिका-संरक्षित डेटा')}
                </p>
              </div>
            </div>

            {/* Item 5: Together for Better Liver Health */}
            <div className="flex items-center gap-3 pt-3 md:pt-0 md:px-4 col-span-2 md:col-span-1">
              <div className="w-10 h-10 rounded-2xl bg-amber-100/80 text-amber-700 flex items-center justify-center shrink-0">
                <HeartPulse className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 leading-tight">
                  {t('Together for Better Liver Health', 'बेहतर लिवर स्वास्थ्य के लिए एकजुट')}
                </p>
                <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                  {t('Coordinated Care', 'समन्वित देखभाल')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          6. HOW CIRRHOCARE AI WORKS
          Workflow section with 5 connected steps + right DNA Technology Panel
          ========================================================================= */}
      <section id="how-it-works" className="py-16 lg:py-24 bg-white border-b border-slate-200/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Section Header */}
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-black uppercase tracking-wider text-[#1877F2]">
              {t('Standardized Clinical Pipeline', 'मानकीकृत नैदानिक ​​पाइपलाइन')}
            </span>
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-1 mb-3">
              {t('How CirrhoCare AI Works', 'CirrhoCare AI कैसे काम करता है')}
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed font-normal">
              {t(
                'A connected workflow across all roles for better liver health outcomes.',
                'बेहतर लिवर स्वास्थ्य परिणामों के लिए सभी भूमिकाओं में जुड़ा हुआ वर्कफ़्लो।'
              )}
            </p>
          </div>

          <div className="grid lg:grid-cols-12 gap-10 items-center">
            {/* Left/Center: Five Connected Steps (7 Cols) */}
            <div className="lg:col-span-7 space-y-4">
              {/* Step 01: Patient Registration */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-blue-300 hover:bg-white shadow-xs transition-all flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-[#1877F2] font-black text-sm flex items-center justify-center shrink-0 border border-blue-200/60">
                  01
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-[#1877F2]" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t('Patient Registration', 'रोगी पंजीकरण')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('Patients join and create their profile.', 'मरीज जुड़ते हैं और अपना प्रोफ़ाइल बनाते हैं।')}
                  </p>
                </div>
              </div>

              {/* Step 02: Lab Testing */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-teal-300 hover:bg-white shadow-xs transition-all flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 font-black text-sm flex items-center justify-center shrink-0 border border-teal-200/60">
                  02
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t('Lab Testing', 'लैब परीक्षण')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t(
                      'Lab technicians record tests and upload results.',
                      'लैब तकनीशियन परीक्षण रिकॉर्ड करते हैं और परिणाम अपलोड करते हैं।'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 03: Clinical Review */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-purple-300 hover:bg-white shadow-xs transition-all flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 font-black text-sm flex items-center justify-center shrink-0 border border-purple-200/60">
                  03
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-purple-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t('Clinical Review', 'नैदानिक ​​समीक्षा')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t(
                      'Hepatologists analyze data with AI insights.',
                      'हेपेटोलॉजिस्ट एआई अंतर्दृष्टि के साथ डेटा का विश्लेषण करते हैं।'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 04: Treatment & Follow-up */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-amber-300 hover:bg-white shadow-xs transition-all flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 font-black text-sm flex items-center justify-center shrink-0 border border-amber-200/60">
                  04
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CalendarCheck className="w-4 h-4 text-amber-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t('Treatment & Follow-up', 'उपचार और अनुवर्ती')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t(
                      'Care plans and appointments are managed.',
                      'देखभाल योजनाओं और नियुक्तियों का प्रबंधन किया जाता है।'
                    )}
                  </p>
                </div>
              </div>

              {/* Step 05: Better Outcomes */}
              <div className="p-4 sm:p-5 rounded-2xl bg-[#F8FAFC] border border-slate-200/80 hover:border-emerald-300 hover:bg-white shadow-xs transition-all flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 font-black text-sm flex items-center justify-center shrink-0 border border-emerald-200/60">
                  05
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <HeartPulse className="w-4 h-4 text-emerald-600" />
                    <h3 className="text-sm font-bold text-slate-900">
                      {t('Better Outcomes', 'बेहतर परिणाम')}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    {t('Patients receive more informed care.', 'मरीजों को अधिक सूचित देखभाल मिलती है।')}
                  </p>
                </div>
              </div>
            </div>

            {/* Right: Technology Panel with DNA Graphic (5 Cols) */}
            <div className="lg:col-span-5">
              <div className="rounded-3xl bg-gradient-to-br from-[#0F172A] via-[#1E293B] to-[#0A192F] text-white p-7 sm:p-8 shadow-2xl border border-slate-700/60 relative overflow-hidden">
                {/* Glowing cyan background ambient */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                {/* DNA Double-Helix Vector Illustration */}
                <div className="h-44 w-full flex items-center justify-center relative mb-6">
                  <svg
                    viewBox="0 0 280 120"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="w-full h-full max-w-xs drop-shadow-[0_0_12px_rgba(56,189,248,0.5)]"
                  >
                    {/* Flowing Strand 1 */}
                    <path
                      d="M10 60 Q 45 10, 80 60 T 150 60 T 220 60 T 270 60"
                      stroke="#38BDF8"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Flowing Strand 2 */}
                    <path
                      d="M10 60 Q 45 110, 80 60 T 150 60 T 220 60 T 270 60"
                      stroke="#818CF8"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                    />
                    {/* Connecting base rungs */}
                    <line x1="30" y1="36" x2="30" y2="84" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="60" y1="42" x2="60" y2="78" stroke="#818CF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="100" y1="78" x2="100" y2="42" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="130" y1="84" x2="130" y2="36" stroke="#818CF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="170" y1="36" x2="170" y2="84" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="200" y1="42" x2="200" y2="78" stroke="#818CF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />
                    <line x1="240" y1="78" x2="240" y2="42" stroke="#38BDF8" strokeWidth="2" strokeDasharray="3 3" opacity="0.7" />

                    {/* Glowing nodes */}
                    <circle cx="30" cy="36" r="4.5" fill="#38BDF8" />
                    <circle cx="30" cy="84" r="4.5" fill="#818CF8" />
                    <circle cx="100" cy="78" r="4.5" fill="#38BDF8" />
                    <circle cx="100" cy="42" r="4.5" fill="#818CF8" />
                    <circle cx="170" cy="36" r="4.5" fill="#38BDF8" />
                    <circle cx="170" cy="84" r="4.5" fill="#818CF8" />
                    <circle cx="240" cy="78" r="4.5" fill="#38BDF8" />
                    <circle cx="240" cy="42" r="4.5" fill="#818CF8" />
                  </svg>
                </div>

                {/* Panel Title */}
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug mb-3">
                  {t(
                    'Data. Intelligence. Collaboration. Better Liver Health.',
                    'डेटा। बुद्धिमत्ता। सहयोग। बेहतर लिवर स्वास्थ्य।'
                  )}
                </h3>

                <p className="text-xs text-slate-300 leading-relaxed mb-6 font-normal">
                  {t(
                    'A specialized computational framework harmonizing 16 physiological biomarkers with decision-support machine learning models.',
                    '16 शारीरिक बायोमार्कर को निर्णय-समर्थन मशीन लर्निंग मॉडल के साथ समरूप बनाने वाला एक विशेष कम्प्यूटेशनल ढांचा।'
                  )}
                </p>

                {/* Feature Labels: Predict • Prevent • Personalize • Improve */}
                <div className="pt-4 border-t border-slate-700/80 grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                  <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-cyan-300">
                    {t('Predict', 'पूर्वानुमान')}
                  </div>
                  <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-indigo-300">
                    {t('Prevent', 'रोकथाम')}
                  </div>
                  <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-teal-300">
                    {t('Personalize', 'वैयक्तिकरण')}
                  </div>
                  <div className="px-2 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-emerald-300">
                    {t('Improve', 'सुधार')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          7. BOTTOM CALL-TO-ACTION
          Dark navy-blue bottom banner with flowing digital-wave design.
          ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-r from-[#070D1F] via-[#0A192F] to-[#0F1E3D] py-16 lg:py-20 text-white">
        {/* Flowing Digital Wave SVG Graphic matching Reference */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <svg
            className="w-full h-full object-cover"
            viewBox="0 0 1440 320"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="none"
          >
            <path
              d="M0,160 C320,300 420,40 720,160 C1020,280 1120,40 1440,160 L1440,320 L0,320 Z"
              fill="url(#wave-gradient-1)"
              opacity="0.4"
            />
            <path
              d="M0,220 C360,100 520,300 840,180 C1160,60 1260,260 1440,200 L1440,320 L0,320 Z"
              fill="url(#wave-gradient-2)"
              opacity="0.3"
            />
            <defs>
              <linearGradient id="wave-gradient-1" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#1877F2" />
                <stop offset="50%" stopColor="#38BDF8" />
                <stop offset="100%" stopColor="#4F46E5" />
              </linearGradient>
              <linearGradient id="wave-gradient-2" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#0D9488" />
                <stop offset="50%" stopColor="#1877F2" />
                <stop offset="100%" stopColor="#8B5CF6" />
              </linearGradient>
            </defs>
          </svg>
        </div>

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-cyan-300 text-xs font-bold backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5" />
            <span>{t('Modern Liver Health Platform', 'आधुनिक लिवर स्वास्थ्य मंच')}</span>
          </div>

          {/* Heading */}
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white leading-tight">
            {t(
              'Be a Part of a Smarter, Healthier Tomorrow',
              'एक समझदार, स्वस्थ कल का हिस्सा बनें'
            )}
          </h2>

          {/* Supporting Text */}
          <p className="text-base sm:text-lg text-slate-300 leading-relaxed font-normal max-w-2xl mx-auto">
            {t(
              'Join CirrhoCare AI and experience a unified platform for better liver care, smarter decisions and improved patient outcomes.',
              'CirrhoCare AI से जुड़ें और बेहतर लिवर देखभाल, समझदार निर्णयों और बेहतर रोगी परिणामों के लिए एक एकीकृत मंच का अनुभव करें।'
            )}
          </p>

          {/* Primary CTA Button */}
          <div className="pt-2 flex justify-center">
            <Link to={isAuthenticated ? getDashboardRoute() : '/login'}>
              <Button
                variant="primary"
                size="lg"
                className="bg-[#1877F2] hover:bg-blue-600 text-white font-extrabold text-sm px-8 py-4 rounded-xl shadow-xl shadow-blue-500/30 flex items-center gap-2"
              >
                <span>{t('Get Started Today', 'आज ही शुरू करें')}</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* =========================================================================
          FOOTER & CLINICAL DISCLAIMER
          ========================================================================= */}
      <footer id="about" className="bg-[#0B132B] text-slate-400 text-xs border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Col 1: Brand */}
            <div className="col-span-2 md:col-span-1 space-y-3">
              <div className="flex items-center gap-2 text-white font-black text-base">
                <div className="w-7 h-7 rounded-lg bg-[#1877F2] flex items-center justify-center text-white">
                  <HeartPulse className="w-4 h-4" />
                </div>
                <span>CirrhoCare AI</span>
              </div>
              <p className="text-slate-400 text-xs leading-relaxed">
                {t(
                  'Unified multi-role platform for longitudinal liver disease risk surveillance and coordinated patient care.',
                  'लगातार लिवर रोग जोखिम निगरानी और समन्वित रोगी देखभाल के लिए एकीकृत बहु-भूमिका मंच।'
                )}
              </p>
            </div>

            {/* Col 2: Navigation */}
            <div className="space-y-2">
              <p className="font-bold text-white text-xs uppercase tracking-wider">
                {t('Navigation', 'नेविगेशन')}
              </p>
              <ul className="space-y-1.5 text-slate-400">
                <li><button onClick={() => scrollToSection('home')} className="hover:text-white transition">{t('Home', 'होम')}</button></li>
                <li><button onClick={() => scrollToSection('platform')} className="hover:text-white transition">{t('Our Platform', 'हमारा प्लेटफ़ॉर्म')}</button></li>
                <li><button onClick={() => scrollToSection('how-it-works')} className="hover:text-white transition">{t('Workflow', 'वर्कफ़्लो')}</button></li>
                <li><Link to="/login" className="hover:text-white transition">{t('Sign In', 'साइन इन')}</Link></li>
              </ul>
            </div>

            {/* Col 3: Role Portals */}
            <div className="space-y-2">
              <p className="font-bold text-white text-xs uppercase tracking-wider">
                {t('Role Portals', 'भूमिका पोर्टल')}
              </p>
              <ul className="space-y-1.5 text-slate-400">
                <li><Link to="/doctor" className="hover:text-white transition">{t('For Clinicians', 'चिकित्सकों के लिए')}</Link></li>
                <li><Link to="/lab" className="hover:text-white transition">{t('For Laboratories', 'प्रयोगशालाओं के लिए')}</Link></li>
                <li><Link to="/patient" className="hover:text-white transition">{t('For Patients', 'रोगियों के लिए')}</Link></li>
                <li><Link to="/admin" className="hover:text-white transition">{t('For Administrators', 'व्यवस्थापकों के लिए')}</Link></li>
              </ul>
            </div>

            {/* Col 4: Trust & Support */}
            <div className="space-y-2">
              <p className="font-bold text-white text-xs uppercase tracking-wider">
                {t('Security & Contact', 'सुरक्षा एवं संपर्क')}
              </p>
              <ul className="space-y-1.5 text-slate-400">
                <li className="flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{t('Role-Protected Storage', 'भूमिका-संरक्षित स्टोरेज')}</span>
                </li>
                <li className="flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{t('Audit Trail Logging', 'ऑडिट ट्रेल लॉगिंग')}</span>
                </li>
                <li className="pt-1">
                  <button
                    onClick={() => setContactModalOpen(true)}
                    className="text-cyan-400 hover:text-cyan-300 font-semibold"
                  >
                    support@cirrhocare.ai
                  </button>
                </li>
              </ul>
            </div>
          </div>

          {/* Experimental Model Disclaimer */}
          <div className="pt-6 border-t border-slate-800 text-center text-[11px] text-slate-400 leading-relaxed max-w-4xl mx-auto">
            {t(
              'CirrhoCare AI predictions are experimental decision-support estimates trained on 17 benchmark observations. Results are not a definitive diagnosis and require qualified clinician confirmation. CirrhoCare AI does not claim FDA/CE clearance or formal clinical validation.',
              'CirrhoCare AI के पूर्वानुमान 17 बेंचमार्क अवलोकनों पर प्रशिक्षित प्रायोगिक निर्णय-समर्थन अनुमान हैं। परिणाम कोई अंतिम निदान नहीं हैं और योग्य चिकित्सक पुष्टि की आवश्यकता है।'
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2">
            <span>© 2026 CirrhoCare AI. {t('All rights reserved.', 'सर्वाधिकार सुरक्षित।')}</span>
            <span>{t('Version 2.0 • Healthcare SaaS Platform', 'संस्करण 2.0 • हेल्थकेयर सास प्लेटफॉर्म')}</span>
          </div>
        </div>
      </footer>

      {/* =========================================================================
          DEMO WALKTHROUGH MODAL ("Watch Demo")
          Provides an interactive 4-role clinical tour without external dependencies.
          ========================================================================= */}
      {demoModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-[#1877F2] flex items-center justify-center">
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {t('CirrhoCare AI Platform Walkthrough', 'CirrhoCare AI प्लेटफ़ॉर्म वॉकथ्रू')}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {t('Explore role-specific clinical workflows & tools', 'भूमिका-विशिष्ट नैदानिक ​​वर्कफ़्लो का अन्वेषण करें')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDemoModalOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                aria-label="Close Modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tab Buttons */}
            <div className="px-6 pt-4 pb-2 flex gap-2 border-b border-slate-200 overflow-x-auto text-xs font-bold">
              <button
                onClick={() => setActiveDemoTab('hepatologist')}
                className={`px-3 py-2 rounded-xl transition ${activeDemoTab === 'hepatologist' ? 'bg-purple-100 text-purple-700 font-extrabold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('Hepatologist Review', 'हेपेटोलॉजिस्ट समीक्षा')}
              </button>
              <button
                onClick={() => setActiveDemoTab('lab')}
                className={`px-3 py-2 rounded-xl transition ${activeDemoTab === 'lab' ? 'bg-teal-100 text-teal-700 font-extrabold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('Laboratory Entry', 'लैब डेटा प्रविष्टि')}
              </button>
              <button
                onClick={() => setActiveDemoTab('patient')}
                className={`px-3 py-2 rounded-xl transition ${activeDemoTab === 'patient' ? 'bg-rose-100 text-rose-700 font-extrabold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('Patient Health Portal', 'रोगी स्वास्थ्य पोर्टल')}
              </button>
              <button
                onClick={() => setActiveDemoTab('admin')}
                className={`px-3 py-2 rounded-xl transition ${activeDemoTab === 'admin' ? 'bg-blue-100 text-blue-700 font-extrabold' : 'text-slate-600 hover:bg-slate-100'}`}
              >
                {t('Admin Governance', 'व्यवस्थापक प्रबंधन')}
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto space-y-4 text-xs">
              {activeDemoTab === 'hepatologist' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-purple-50/70 border border-purple-200 flex items-start gap-3">
                    <BrainCircuit className="w-5 h-5 text-purple-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {t('Clinical Decision Support & Risk Triage', 'नैदानिक ​​निर्णय समर्थन एवं जोखिम वर्गीकरण')}
                      </h4>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {t(
                          'Hepatologists view high-risk cohorts sorted by Random Forest prediction probability (e.g. 78.5% High Risk), review histological biomarker trends, prescribe targeted therapies with dietary instructions, and schedule follow-ups.',
                          'हेपेटोलॉजिस्ट रैंडम फ़ॉरेस्ट भविष्यवाणी संभावना द्वारा क्रमबद्ध उच्च जोखिम वाले समूहों को देखते हैं, बायोमार्कर प्रवृत्तियों की समीक्षा करते हैं, और उपचार योजनाएं बनाते हैं।'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="block text-slate-400 font-bold">{t('Model', 'मॉडल')}</span>
                      <strong className="text-slate-800 text-xs">Random Forest v1.7</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="block text-slate-400 font-bold">{t('Risk Score', 'जोखिम स्कोर')}</span>
                      <strong className="text-rose-600 text-xs">78.5% (High Risk)</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="block text-slate-400 font-bold">{t('Urgency', 'प्राथमिकता')}</span>
                      <strong className="text-amber-600 text-xs">{t('Needs Review', 'समीक्षा आवश्यक')}</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeDemoTab === 'lab' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-teal-50/70 border border-teal-200 flex items-start gap-3">
                    <FlaskConical className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {t('Streamlined Biomarker Capture & PDF Uploads', 'सुव्यवस्थित बायोमार्कर प्रविष्टि एवं पीडीएफ अपलोड')}
                      </h4>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {t(
                          'Lab technicians enter key clinical parameters: Bilirubin (mg/dL), Albumin (g/dL), Platelets, Copper, SGOT, and Alkaline Phosphatase. Files are stored securely and automatically associated with the patient record.',
                          'लैब तकनीशियन मुख्य नैदानिक ​​मापदंड दर्ज करते हैं: बिलीरुबिन, एल्ब्यूमिन, प्लेटलेट्स, कॉपर और एसजीओटी। फाइलें सुरक्षित रूप से संग्रहीत होती हैं।'
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Bilirubin (Serum)</span>
                      <span className="text-slate-900 font-mono">3.2 mg/dL</span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Albumin</span>
                      <span className="text-slate-900 font-mono">2.9 g/dL</span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-700">
                      <span>Platelets</span>
                      <span className="text-slate-900 font-mono">120 x10^9/L</span>
                    </div>
                  </div>
                </div>
              )}

              {activeDemoTab === 'patient' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-200 flex items-start gap-3">
                    <HeartPulse className="w-5 h-5 text-rose-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {t('Transparent Patient Health Portal', 'पारदर्शी रोगी स्वास्थ्य पोर्टल')}
                      </h4>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {t(
                          'Patients log in securely with their Patient ID (e.g. PAT-1001) to view evaluated medical reports, doctor recommendations, prescribed medications with dosages, and upcoming clinic visits.',
                          'मरीज अपनी रोगी आईडी के साथ सुरक्षित रूप से लॉग इन करते हैं और अपनी मेडिकल रिपोर्ट, डॉक्टरों की सिफारिशें और दवाएं देखते हैं।'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {activeDemoTab === 'admin' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-200 flex items-start gap-3">
                    <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">
                        {t('System Oversight & Immutable Audit Trails', 'सिस्टम निगरानी एवं अपरिवर्तनीय ऑडिट ट्रेल्स')}
                      </h4>
                      <p className="text-slate-600 mt-1 leading-relaxed">
                        {t(
                          'Administrators supervise 4 user roles (Admin, Hepatologist, Lab Tech, Patient), verify system health, and inspect granular activity logs for audit and security compliance.',
                          'व्यवस्थापक 4 उपयोगकर्ता भूमिकाओं की निगरानी करते हैं, सिस्टम स्वास्थ्य को सत्यापित करते हैं, और गतिविधि लॉग का निरीक्षण करते हैं।'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-medium">
                {t('Ready to experience CirrhoCare AI?', 'CirrhoCare AI का अनुभव करने के लिए तैयार हैं?')}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setDemoModalOpen(false)}
                >
                  {t('Close', 'बंद करें')}
                </Button>
                <Link to="/login">
                  <Button
                    variant="primary"
                    size="sm"
                    className="bg-[#1877F2] hover:bg-blue-700 text-white font-bold"
                  >
                    {t('Sign In to Platform', 'प्लेटफ़ॉर्म पर साइन इन करें')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CONTACT MODAL
          ========================================================================= */}
      {contactModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#1877F2] flex items-center justify-center">
                  <Mail className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-slate-900 text-base">
                  {t('Contact CirrhoCare AI', 'CirrhoCare AI से संपर्क करें')}
                </h3>
              </div>
              <button
                onClick={() => setContactModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-600">
              <p className="leading-relaxed">
                {t(
                  'For institutional deployment inquiries, clinical trial partnerships, or technical support, please reach out to our team.',
                  'संस्थागत तैनाती पूछताछ, नैदानिक ​​परीक्षण साझेदारी, या तकनीकी सहायता के लिए, कृपया हमारी टीम से संपर्क करें।'
                )}
              </p>

              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center gap-2 text-slate-800">
                  <Mail className="w-4 h-4 text-blue-600" />
                  <span className="font-semibold">support@cirrhocare.ai</span>
                </div>
                <div className="flex items-center gap-2 text-slate-800">
                  <Globe className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold">https://cirrhocare.ai</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="primary"
                size="sm"
                className="bg-[#1877F2]"
                onClick={() => setContactModalOpen(false)}
              >
                {t('Got it', 'समझ गया')}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default LandingPage;

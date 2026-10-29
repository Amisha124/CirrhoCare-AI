/**
 * CirrhoCare AI - Unified Localization & Translation System
 * Provides centralized English/Hindi dictionary and formatting helpers.
 */

export const HINDI_MONTHS: Record<number, string> = {
  0: 'जनवरी',
  1: 'फ़रवरी',
  2: 'मार्च',
  3: 'अप्रैल',
  4: 'मई',
  5: 'जून',
  6: 'जुलाई',
  7: 'अगस्त',
  8: 'सितंबर',
  9: 'अक्टूबर',
  10: 'नवंबर',
  11: 'दिसंबर',
};

export const HINDI_DAYS: Record<number, string> = {
  0: 'रविवार',
  1: 'सोमवार',
  2: 'मंगलवार',
  3: 'बुधवार',
  4: 'गुरुवार',
  5: 'शुक्रवार',
  6: 'शनिवार',
};

/**
 * Format date string into strict selected language.
 */
export function formatDateLocalized(dateStr: string | null | undefined, isHindi: boolean): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';

  if (isHindi) {
    const day = d.getDate();
    const month = HINDI_MONTHS[d.getMonth()] || '';
    const year = d.getFullYear();
    return `${day} ${month} ${year}`;
  }

  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Format full date with day of week in selected language.
 */
export function formatFullDateLocalized(dateInput: Date | string | null | undefined = new Date(), isHindi: boolean = false): string {
  if (!dateInput) return '';
  const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
  if (isNaN(d.getTime())) return '';

  if (isHindi) {
    const day = d.getDate();
    const month = HINDI_MONTHS[d.getMonth()] || '';
    const year = d.getFullYear();
    const weekday = HINDI_DAYS[d.getDay()] || '';
    return `${weekday}, ${day} ${month} ${year}`;
  }

  return d.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/**
 * Map clinical treatment lifecycle status into strict selected language.
 */
export function getTreatmentStatusText(status: string | null | undefined, isHindi: boolean): string {
  if (!status) return isHindi ? 'डॉक्टर समीक्षा की प्रतीक्षा' : 'Awaiting review';
  const s = status.trim().toLowerCase();

  if (s.includes('treatment completed') || s === 'completed') {
    return isHindi ? 'उपचार पूर्ण' : 'Treatment Completed';
  }
  if (s.includes('under treatment')) {
    return isHindi ? 'उपचाराधीन' : 'Under Treatment';
  }
  if (s.includes('follow-up required') || s.includes('follow-up')) {
    return isHindi ? 'फॉलो-अप आवश्यक' : 'Follow-up Required';
  }
  if (s.includes('urgent')) {
    return isHindi ? 'तत्काल समीक्षा आवश्यक' : 'Needs urgent review';
  }
  if (s.includes('awaiting')) {
    return isHindi ? 'डॉक्टर समीक्षा की प्रतीक्षा' : 'Awaiting Doctor Review';
  }
  if (s.includes('stable')) {
    return isHindi ? 'स्थिर स्थिति' : 'Stable';
  }

  return status;
}

/**
 * Map lab order diagnostic status into strict selected language.
 */
export function getLabStatusText(status: string | null | undefined, isHindi: boolean): string {
  if (!status) return isHindi ? 'अज्ञात' : 'Unknown';
  const s = status.trim().toLowerCase();

  if (s === 'registered') return isHindi ? 'पंजीकृत' : 'Registered';
  if (s === 'test in progress' || s === 'in progress') return isHindi ? 'परीक्षण प्रगति पर है' : 'Test in Progress';
  if (s === 'report uploaded' || s === 'pdf uploaded') return isHindi ? 'रिपोर्ट अपलोड की गई' : 'Report Uploaded';
  if (s === 'test pending') return isHindi ? 'परीक्षण लंबित' : 'Test Pending';
  if (s === 'report pending') return isHindi ? 'रिपोर्ट लंबित' : 'Report Pending';
  if (s === 'sample collected') return isHindi ? 'नमूना एकत्र' : 'Sample Collected';
  if (s === 'test ordered' || s === 'ordered') return isHindi ? 'परीक्षण आदेशित' : 'Test Ordered';
  if (s === 'completed') return isHindi ? 'पूर्ण' : 'Completed';
  if (s === 'clarification required') return isHindi ? 'स्पष्टीकरण आवश्यक' : 'Clarification Required';
  if (s === 'cancelled') return isHindi ? 'रद्द' : 'Cancelled';

  return status;
}

export const getLabOrderStatusText = getLabStatusText;

/**
 * Map diagnostic report review status into strict selected language.
 */
export function getReportReviewStatusText(status: string | null | undefined, isHindi: boolean): string {
  if (!status) return isHindi ? 'कोई रिपोर्ट अपलोड नहीं है' : 'No reports uploaded';
  const s = status.trim().toLowerCase();

  if (s.includes('awaiting') || s.includes('pending') || s.includes('unreviewed')) {
    return isHindi ? 'डॉक्टर समीक्षा की प्रतीक्षा' : 'Awaiting doctor review';
  }
  if (s.includes('reviewed') || s.includes('completed')) {
    return isHindi ? 'डॉक्टर द्वारा समीक्षित' : 'Reviewed by doctor';
  }
  if (s.includes('no report')) {
    return isHindi ? 'कोई रिपोर्ट अपलोड नहीं है' : 'No reports uploaded';
  }

  return isHindi ? 'समीक्षाधीन' : status;
}

/**
 * Map risk label into strict selected language.
 */
export function getRiskLevelText(risk: string | null | undefined, isHindi: boolean): string {
  if (!risk) return isHindi ? 'लंबित' : 'Pending';
  const r = risk.trim().toLowerCase();

  if (r.includes('high')) {
    return isHindi ? 'उच्च जोखिम' : 'High Risk';
  }
  if (r.includes('med')) {
    return isHindi ? 'मध्यम जोखिम' : 'Medium Risk';
  }
  if (r.includes('low')) {
    return isHindi ? 'कम जोखिम' : 'Low Risk';
  }
  return isHindi ? 'लंबित' : 'Pending';
}

/**
 * Map appointment status into strict selected language.
 */
export function getAppointmentStatusText(status: string | null | undefined, isHindi: boolean): string {
  if (!status) return '';
  const s = status.trim().toLowerCase();
  if (s === 'confirmed') return isHindi ? 'पुष्ट' : 'Confirmed';
  if (s === 'pending') return isHindi ? 'लंबित' : 'Pending';
  if (s.includes('reschedule')) return isHindi ? 'पुनर्निर्धारण प्रस्तावित' : 'Reschedule Proposed';
  if (s === 'completed') return isHindi ? 'पूर्ण' : 'Completed';
  if (s === 'rejected') return isHindi ? 'अस्वीकृत' : 'Rejected';
  if (s === 'cancelled') return isHindi ? 'रद्द' : 'Cancelled';
  return status;
}

/**
 * Map common appointment clinical reasons into strict selected language.
 */
export function getAppointmentReasonText(reason: string | null | undefined, isHindi: boolean): string {
  if (!reason) return isHindi ? 'नियमित परामर्श' : 'Routine Consultation';
  if (!isHindi) return reason.replace(/\s*\[demo\]/i, '').trim();

  const lower = reason.toLowerCase();
  if (lower.includes('follow-up') || lower.includes('consultation')) {
    return 'फॉलो-अप परामर्श';
  }
  if (lower.includes('report') || lower.includes('discussion')) {
    return 'लैब रिपोर्ट चर्चा';
  }
  if (lower.includes('check-up') || lower.includes('routine')) {
    return 'नियमित स्वास्थ्य जांच';
  }
  if (lower.includes('treatment') || lower.includes('review')) {
    return 'उपचार समीक्षा';
  }
  if (lower.includes('cirrhosis') || lower.includes('liver')) {
    return 'यकृत स्वास्थ्य परामर्श';
  }

  return reason;
}

/**
 * Map biomarker name into strict selected language.
 */
export function getBiomarkerName(name: string, isHindi: boolean): string {
  if (!isHindi) return name;
  const n = name.trim().toLowerCase();

  if (n.includes('total bilirubin')) return 'कुल बिलीरुबिन';
  if (n.includes('direct bilirubin')) return 'प्रत्यक्ष बिलीरुबिन';
  if (n.includes('sgot') || n.includes('ast')) return 'एसजीओटी (AST)';
  if (n.includes('sgpt') || n.includes('alt')) return 'एसजीपीटी (ALT)';
  if (n.includes('albumin')) return 'सीरम एल्ब्यूमिन';
  if (n.includes('platelet')) return 'प्लेटलेट्स';
  if (n.includes('prothrombin')) return 'प्रोथ्रोम्बिन समय';
  if (n.includes('alkaline') || n.includes('alk')) return 'क्षारीय फॉस्फेटेज (ALP)';
  if (n.includes('copper')) return 'कॉपर';
  if (n.includes('cholesterol')) return 'कोलेस्ट्रॉल';
  if (n.includes('triglyceride')) return 'ट्राइग्लिसराइड्स';

  return name;
}

/**
 * Central dictionary mapping keys/phrases to English & Hindi
 */
export const translations: Record<string, { en: string; hi: string }> = {
  // Navigation & General
  'Dashboard': { en: 'Dashboard', hi: 'डैशबोर्ड' },
  'Overview': { en: 'Overview', hi: 'अवलोकन' },
  'Patients': { en: 'Patients', hi: 'मरीज़' },
  'Patient Records': { en: 'Patient Records', hi: 'रोगी रिकॉर्ड' },
  'Users & Staff': { en: 'Users & Staff', hi: 'उपयोगकर्ता और कर्मचारी' },
  'Patient Monitoring': { en: 'Patient Monitoring', hi: 'रोगी निगरानी' },
  'Treatment Monitoring': { en: 'Treatment Monitoring', hi: 'उपचार निगरानी' },
  'Reports & Analytics': { en: 'Reports & Analytics', hi: 'रिपोर्ट और एनालिटिक्स' },
  'Security & Audit Logs': { en: 'Security & Audit Logs', hi: 'सुरक्षा एवं ऑडिट लॉग' },
  'Appointment Requests': { en: 'Appointment Requests', hi: 'अपॉइंटमेंट अनुरोध' },
  'My Reports': { en: 'My Reports', hi: 'मेरी रिपोर्ट' },
  'My Prescriptions': { en: 'My Prescriptions', hi: 'मेरे पर्चे' },
  'Appointments': { en: 'Appointments', hi: 'अपॉइंटमेंट' },
  'Logout': { en: 'Logout', hi: 'लॉग आउट' },
  'Language': { en: 'Language', hi: 'भाषा' },
  'Settings': { en: 'Settings', hi: 'सेटिंग्स' },
  'Notifications': { en: 'Notifications', hi: 'सूचनाएं' },

  // Common Actions
  'Save': { en: 'Save', hi: 'सहेजें' },
  'Cancel': { en: 'Cancel', hi: 'रद्द करें' },
  'Close': { en: 'Close', hi: 'बंद करें' },
  'Submit': { en: 'Submit', hi: 'जमा करें' },
  'Refresh': { en: 'Refresh', hi: 'रिफ्रेश करें' },
  'View Details': { en: 'View Details', hi: 'विवरण देखें' },
  'Download': { en: 'Download', hi: 'डाउनलोड करें' },
  'View PDF': { en: 'View PDF', hi: 'पीडीएफ देखें' },
  'Search': { en: 'Search', hi: 'खोजें' },
  'Reset Filters': { en: 'Reset Filters', hi: 'फ़िल्टर रीसेट करें' },
  'Confirm': { en: 'Confirm', hi: 'पुष्टि करें' },
  'Reject': { en: 'Reject', hi: 'अस्वीकार करें' },

  // Statuses
  'Awaiting Doctor Review': { en: 'Awaiting Doctor Review', hi: 'डॉक्टर समीक्षा की प्रतीक्षा' },
  'Under Treatment': { en: 'Under Treatment', hi: 'उपचाराधीन' },
  'Follow-up Required': { en: 'Follow-up Required', hi: 'फॉलो-अप आवश्यक' },
  'Treatment Completed': { en: 'Treatment Completed', hi: 'उपचार पूर्ण' },
  'Registered': { en: 'Registered', hi: 'पंजीकृत' },
  'Test in Progress': { en: 'Test in Progress', hi: 'परीक्षण प्रगति पर है' },
  'Report Uploaded': { en: 'Report Uploaded', hi: 'रिपोर्ट अपलोड की गई' },
  'High Risk': { en: 'High Risk', hi: 'उच्च जोखिम' },
  'Medium Risk': { en: 'Medium Risk', hi: 'मध्यम जोखिम' },
  'Low Risk': { en: 'Low Risk', hi: 'कम जोखिम' },
  'Pending': { en: 'Pending', hi: 'लंबित' },
  'Confirmed': { en: 'Confirmed', hi: 'पुष्ट' },

  // Roles
  'Administrator': { en: 'Administrator', hi: 'सिस्टम व्यवस्थापक' },
  'Hepatologist': { en: 'Hepatologist', hi: 'हेपेटोलॉजिस्ट' },
  'Lab Technician': { en: 'Lab Technician', hi: 'लैब तकनीशियन' },
  'Patient': { en: 'Patient', hi: 'रोगी' },
};

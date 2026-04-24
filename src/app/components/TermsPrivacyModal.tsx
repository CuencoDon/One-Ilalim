"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";

const MODAL_BACKDROP_CLASS = "fixed inset-0 bg-white/10 backdrop-blur-sm";

type TabType = "terms" | "privacy";

const termsContent = `
# Terms and Conditions

**Last Updated:** April 1, 2026

## 1. Acceptance of Terms
By accessing or using **One Ilalim** (the "Platform"), you agree to be bound by these Terms and Conditions. If you do not agree, please do not use the Platform.

## 2. Eligibility
You must be at least 18 years old or have parental consent to use the Platform. By signing up, you confirm that you meet this requirement.

## 3. Account Registration
- You agree to provide accurate, current, and complete information during registration.
- You are responsible for maintaining the confidentiality of your login credentials.
- You agree to notify us immediately of any unauthorized use of your account.

## 4. User Roles and Passcodes
- **Residents** must enter the resident passcode during sign‑up to verify their status.
- **Barangay Officials** must enter the official passcode to obtain elevated privileges.
- Passcodes are provided by the barangay administration and must not be shared.

## 5. Acceptable Use
You agree not to:
- Use the Platform for any unlawful purpose.
- Attempt to gain unauthorized access to any part of the Platform.
- Post or transmit any harmful, offensive, or misleading content.
- Impersonate another person or entity.

## 6. Purpose of the Platform
**One Ilalim** is designed to help residents and barangay officials:
- Report disasters and emergencies.
- Monitor real‑time water levels.
- View current and forecasted weather conditions.

## 7. Content and Privacy
- Your use of the Platform is also governed by our **Privacy Policy** (see below).
- We reserve the right to remove any content that violates these terms.

## 8. Modifications
We may update these Terms and Conditions at any time. Continued use of the Platform after changes constitutes acceptance of the revised terms.

## 9. Limitation of Liability
The Platform is provided "as is." To the fullest extent permitted by law, we disclaim all warranties and shall not be liable for any damages arising from your use of the Platform.

## 10. Contact Us
If you have questions, please contact the developer:
**Don Miguel Cuenco**  
**Email:** cuencodonmiguel2@gmail.com  
**Phone Number:** 09262884103
`;

const privacyContent = `
# Privacy Policy

**Last Updated:** April 1, 2026

## 1. Information We Collect
We collect the following personal information when you register:
- Full Name (First and Last)
- Contact Number
- Email Address
- User Role (Resident or Official)
- Account Password (hashed and stored securely)

We may also collect usage data (e.g., IP address, browser type) to improve our services.

## 2. How We Use Your Information
- To create and manage your account.
- To verify your identity and role within the barangay.
- To enable you to report disasters and emergencies.
- To provide water level and weather updates.
- To communicate important announcements.
- To maintain the security and integrity of the Platform.
- To comply with legal obligations.

## 3. Data Sharing and Disclosure
We do not sell your personal information. We may share data:
- With barangay officials for administrative and emergency response purposes.
- When required by law or to protect legal rights.
- With third‑party service providers that help us operate the Platform, under strict confidentiality agreements. These include **Supabase** for database and authentication, and **Vercel** for hosting.

## 4. Data Security
We implement reasonable technical and organizational measures to protect your information. However, no online system is 100% secure; you use the Platform at your own risk.

## 5. Your Rights
You may:
- Request access to, correction of, or deletion of your personal data.
- Withdraw consent for data processing at any time.
- Contact us to exercise these rights.

## 6. Cookies and Tracking
We use essential cookies for authentication and session management. You can disable cookies in your browser, but this may affect functionality.

## 7. Children’s Privacy
The Platform is not intended for children under 13. We do not knowingly collect personal information from children.

## 8. Changes to This Policy
We may update this Privacy Policy from time to time. The latest version will always be posted on the Platform.

## 9. Contact Us
For privacy‑related questions, contact the developer:
**Don Miguel Cuenco**  
**Email:** cuencodonmiguel2@gmail.com  
**Phone Number:** 09262884103
`;

export default function TermsPrivacyModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabType>("terms");
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = 0;
    }
  }, [activeTab]);

  if (!isOpen) return null;

  return (
    <div
      className={`${MODAL_BACKDROP_CLASS} z-[9999] flex items-center justify-center p-4`}
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
        >
          <X size={18} />
        </button>

        <div>
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("terms")}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === "terms"
                  ? "border-b-2 border-blue-900 text-blue-900"
                  : "text-gray-500 hover:text-blue-900"
              }`}
            >
              Terms of Use
            </button>
            <button
              onClick={() => setActiveTab("privacy")}
              className={`pb-2 text-sm font-medium transition-colors ${
                activeTab === "privacy"
                  ? "border-b-2 border-blue-900 text-blue-900"
                  : "text-gray-500 hover:text-blue-900"
              }`}
            >
              Privacy Policy
            </button>
          </div>
        </div>

        <div
          ref={scrollContainerRef}
          className="max-h-[60vh] overflow-y-auto pr-1"
        >
          <div className="prose prose-sm max-w-none [&>*:first-child]:mt-0">
            {activeTab === "terms" ? (
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(termsContent) }} />
            ) : (
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(privacyContent) }} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function markdownToHtml(markdown: string): string {
  const lines = markdown.split('\n');
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;
  let listItems: string[] = [];
  let result: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const tag = listType === 'ul' ? 'ul' : 'ol';
    const itemsHtml = listItems.map(item => `<li>${formatInline(item.trim())}</li>`).join('');
    result.push(`<${tag} class="my-2 pl-5 space-y-1">${itemsHtml}</${tag}>`);
    listItems = [];
    inList = false;
    listType = null;
  };

  const formatInline = (text: string): string => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded">$1</code>');
  };

  for (let line of lines) {
    if (line.startsWith('# ')) {
      flushList();
      result.push(`<h1 class="text-xl font-bold mb-2">${line.slice(2)}</h1>`);
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      result.push(`<h2 class="text-lg font-semibold mt-3 mb-1">${line.slice(3)}</h2>`);
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      result.push(`<h3 class="text-base font-semibold mt-2 mb-1">${line.slice(4)}</h3>`);
      continue;
    }

    const orderedMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (orderedMatch) {
      if (!inList || listType !== 'ol') flushList();
      inList = true;
      listType = 'ol';
      listItems.push(orderedMatch[2]);
      continue;
    }

    const unorderedMatch = line.match(/^-\s+(.*)$/);
    if (unorderedMatch) {
      if (!inList || listType !== 'ul') flushList();
      inList = true;
      listType = 'ul';
      listItems.push(unorderedMatch[1]);
      continue;
    }

    if (line.trim() === '') {
      flushList();
      result.push('<br>');
      continue;
    }

    flushList();

    let html = formatInline(line);
    result.push(`<p class="mb-2">${html}</p>`);
  }

  flushList();

  return result.join('');
}
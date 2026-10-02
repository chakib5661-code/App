/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type DeviceType = 'iphone' | 'android' | 'ipad' | 'tablet' | 'desktop';

export interface DeviceInfo {
  deviceType: DeviceType;
  phoneBrand: string;
  phoneModel: string;
  osName: string;
  osVersion: string;
  browserName: string;
  browserVersion: string;
  isInAppBrowser: boolean;
  inAppName: string | null;
  isStandalone: boolean;
  isMobile: boolean;
  screenResolution: string;
}

export function detectUserDevice(): DeviceInfo {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return {
      deviceType: 'desktop',
      phoneBrand: 'Inconnu',
      phoneModel: 'Bureau',
      osName: 'Inconnu',
      osVersion: '',
      browserName: 'Inconnu',
      browserVersion: '',
      isInAppBrowser: false,
      inAppName: null,
      isStandalone: false,
      isMobile: false,
      screenResolution: '1920x1080',
    };
  }

  const ua = navigator.userAgent || '';
  const vendor = navigator.vendor || '';
  const screenWidth = window.screen?.width || window.innerWidth;
  const screenHeight = window.screen?.height || window.innerHeight;
  const screenResolution = `${screenWidth}x${screenHeight}`;

  // Check standalone mode (PWA already installed and running)
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as any).standalone === true ||
    document.referrer.includes('android-app://');

  // Detect In-App Browsers
  let isInAppBrowser = false;
  let inAppName: string | null = null;

  if (/FBAN|FBAV/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Facebook';
  } else if (/Instagram/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Instagram';
  } else if (/WhatsApp/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'WhatsApp';
  } else if (/TikTok/i.test(ua) || /musical_ly/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'TikTok';
  } else if (/Messenger/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Messenger';
  } else if (/Snapchat/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Snapchat';
  } else if (/Twitter|X-iOS|X-Android/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'X (Twitter)';
  } else if (/LinkedInApp/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'LinkedIn';
  } else if (/\bwv\b|WebView/i.test(ua)) {
    isInAppBrowser = true;
    inAppName = 'Navigateur intégré';
  }

  // Detect OS & Phone Brand / Model
  const isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isIPad = /iPad/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1 && !/iPhone/i.test(ua));
  const isIPhone = /iPhone/i.test(ua) || (isIOS && !isIPad);

  let deviceType: DeviceType = 'desktop';
  let phoneBrand = 'Inconnu';
  let phoneModel = 'Appareil';
  let osName = 'Inconnu';
  let osVersion = '';

  if (isIPhone) {
    deviceType = 'iphone';
    phoneBrand = 'Apple';
    osName = 'iOS';

    // Parse iOS version
    const match = ua.match(/OS (\d+[_.]\d+)/i);
    if (match) {
      osVersion = match[1].replace('_', '.');
    }

    // Model estimation based on screen dimensions and pixel ratio
    const pr = window.devicePixelRatio || 2;
    const w = Math.min(screenWidth, screenHeight);
    const h = Math.max(screenWidth, screenHeight);

    if (w === 430 && h === 932) {
      phoneModel = 'iPhone 15 Pro Max / 16 Plus';
    } else if (w === 393 && h === 852) {
      phoneModel = 'iPhone 15 / 15 Pro / 14 Pro';
    } else if (w === 428 && h === 926) {
      phoneModel = 'iPhone 14 Plus / 13 Pro Max / 12 Pro Max';
    } else if (w === 390 && h === 844) {
      phoneModel = 'iPhone 14 / 13 / 13 Pro / 12 / 12 Pro';
    } else if (w === 375 && h === 812) {
      phoneModel = 'iPhone 13 mini / 12 mini / 11 Pro / X / XS';
    } else if (w === 414 && h === 896) {
      phoneModel = pr === 3 ? 'iPhone 11 Pro Max / XS Max' : 'iPhone 11 / XR';
    } else if (w === 414 && h === 736) {
      phoneModel = 'iPhone 8 Plus / 7 Plus / 6s Plus';
    } else if (w === 375 && h === 667) {
      phoneModel = 'iPhone SE / 8 / 7 / 6s';
    } else {
      phoneModel = `iPhone (iOS ${osVersion || 'Mobile'})`;
    }
  } else if (isIPad) {
    deviceType = 'ipad';
    phoneBrand = 'Apple';
    phoneModel = 'iPad';
    osName = 'iPadOS';
    const match = ua.match(/OS (\d+[_.]\d+)/i);
    if (match) osVersion = match[1].replace('_', '.');
  } else if (isAndroid) {
    deviceType = /Tablet|SM-T/i.test(ua) ? 'tablet' : 'android';
    osName = 'Android';
    const match = ua.match(/Android\s+([0-9.]+)/i);
    if (match) osVersion = match[1];

    // Android Manufacturer & Model detection from User-Agent
    if (/SAMSUNG|SM-|GT-|SCH-|SGH-/i.test(ua)) {
      phoneBrand = 'Samsung';
      const m = ua.match(/(SM-[A-Z0-9]+|GT-[A-Z0-9]+)/i);
      phoneModel = m ? `Samsung Galaxy (${m[1]})` : 'Samsung Galaxy';
      if (/SM-S9/i.test(ua)) phoneModel = 'Samsung Galaxy S-Series (Ultra/Plus)';
      else if (/SM-A/i.test(ua)) phoneModel = 'Samsung Galaxy A-Series';
      else if (/SM-F/i.test(ua)) phoneModel = 'Samsung Galaxy Z Fold / Z Flip';
      else if (/SM-N/i.test(ua)) phoneModel = 'Samsung Galaxy Note';
    } else if (/Xiaomi|Redmi|POCO|Mi\s/i.test(ua)) {
      phoneBrand = 'Xiaomi';
      if (/Redmi/i.test(ua)) {
        const m = ua.match(/Redmi[^;)]+/i);
        phoneModel = m ? m[0] : 'Xiaomi Redmi';
      } else if (/POCO/i.test(ua)) {
        const m = ua.match(/POCO[^;)]+/i);
        phoneModel = m ? m[0] : 'Xiaomi POCO';
      } else {
        phoneModel = 'Xiaomi Mi Phone';
      }
    } else if (/HUAWEI|HONOR/i.test(ua)) {
      phoneBrand = /HONOR/i.test(ua) ? 'Honor' : 'Huawei';
      phoneModel = phoneBrand === 'Honor' ? 'Honor Smartphone' : 'Huawei Smartphone';
    } else if (/Pixel/i.test(ua)) {
      phoneBrand = 'Google';
      const m = ua.match(/Pixel\s*[0-9a-zA-Z\s]+/i);
      phoneModel = m ? m[0].trim() : 'Google Pixel';
    } else if (/OPPO|CPH/i.test(ua)) {
      phoneBrand = 'Oppo';
      phoneModel = 'Oppo Smartphone';
    } else if (/VIVO|V20|V21|V22|V23/i.test(ua)) {
      phoneBrand = 'Vivo';
      phoneModel = 'Vivo Smartphone';
    } else if (/Realme|RMX/i.test(ua)) {
      phoneBrand = 'Realme';
      phoneModel = 'Realme Smartphone';
    } else if (/OnePlus|ONEPLUS/i.test(ua)) {
      phoneBrand = 'OnePlus';
      phoneModel = 'OnePlus Smartphone';
    } else if (/Infinix/i.test(ua)) {
      phoneBrand = 'Infinix';
      phoneModel = 'Infinix Smartphone';
    } else if (/Tecno/i.test(ua)) {
      phoneBrand = 'Tecno';
      phoneModel = 'Tecno Smartphone';
    } else {
      phoneBrand = 'Android';
      // Try generic model token inside parentheses e.g. "Build/..."
      const buildMatch = ua.match(/;\s*([A-Za-z0-9\s_-]+)\s*Build/i);
      phoneModel = buildMatch ? buildMatch[1].trim() : 'Smartphone Android';
    }
  } else {
    // Desktop detection
    deviceType = 'desktop';
    if (/Macintosh|Mac OS X/i.test(ua)) {
      osName = 'macOS';
      phoneBrand = 'Apple';
      phoneModel = 'Mac';
    } else if (/Windows/i.test(ua)) {
      osName = 'Windows';
      phoneBrand = 'PC';
      phoneModel = 'Windows PC';
    } else if (/Linux/i.test(ua)) {
      osName = 'Linux';
      phoneBrand = 'PC';
      phoneModel = 'Linux Desktop';
    }
  }

  // Detect Browser
  let browserName = 'Navigateur Web';
  let browserVersion = '';

  if (/SamsungBrowser/i.test(ua)) {
    browserName = 'Samsung Internet';
    const m = ua.match(/SamsungBrowser\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/CriOS/i.test(ua)) {
    browserName = 'Google Chrome (iOS)';
    const m = ua.match(/CriOS\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/EdgA|Edge|Edg/i.test(ua)) {
    browserName = 'Microsoft Edge';
    const m = ua.match(/Edg[eA]?\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/FxiOS/i.test(ua) || /Firefox/i.test(ua)) {
    browserName = 'Mozilla Firefox';
    const m = ua.match(/(?:Firefox|FxiOS)\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/Chrome/i.test(ua) && !/Chromium|OPR/i.test(ua)) {
    browserName = 'Google Chrome';
    const m = ua.match(/Chrome\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)) {
    browserName = 'Safari';
    const m = ua.match(/Version\/([0-9.]+)/i);
    if (m) browserVersion = m[1];
  } else if (/OPR|Opera/i.test(ua)) {
    browserName = 'Opera';
  }

  const isMobile = deviceType === 'iphone' || deviceType === 'android';

  return {
    deviceType,
    phoneBrand,
    phoneModel,
    osName,
    osVersion,
    browserName,
    browserVersion,
    isInAppBrowser,
    inAppName,
    isStandalone,
    isMobile,
    screenResolution,
  };
}

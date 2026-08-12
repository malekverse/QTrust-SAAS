# Q-Trust App Scanner

جمعية المحافظة على القرآن الكريم - صفاقس

A beautiful, Islamic-themed React Native QR scanner app for student attendance tracking at the Association for the Preservation of the Holy Quran in Sfax.

## Features

- 📱 **QR Code Scanning**: Fast, reliable QR code scanning for student check-in
- 🎨 **Islamic Design**: Elegant, calm, spiritual UI with geometric patterns
- 🌙 **Dark/Light Mode**: Full theme support with beautiful Islamic color palette
- 📊 **Scan History**: Track recent scans for debugging
- ⚙️ **Easy Configuration**: Simple device setup with environment presets
- 🔒 **Secure**: Device token authentication and secure storage
- 📱 **Tablet Optimized**: Designed primarily for Android tablets, works on phones too

## Tech Stack

- **React Native** (via Expo SDK 54)
- **TypeScript** for type safety
- **Expo Router** for file-based navigation
- **Zustand** for state management
- **TanStack Query** for data fetching
- **React Native Reanimated** for smooth animations

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- Android Studio (for Android development)

### Installation

```bash
# Install dependencies
npm install

# Start the development server
npm start

# Run on Android
npm run android

# Run on iOS (macOS only)
npm run ios
```

### Configuration

On first launch, you'll be prompted to configure:

1. **Server Environment**: Choose Production, Staging, Development, or Custom
2. **Device Token**: Enter the token provided by the administrator

## Project Structure

```
├── app/                    # Expo Router screens
│   ├── _layout.tsx        # Root layout with providers
│   ├── index.tsx          # Loading/splash screen
│   ├── setup.tsx          # Device configuration
│   ├── scanner.tsx        # Main QR scanner
│   └── settings.tsx       # Settings screen
├── src/
│   ├── api/               # API client and endpoints
│   │   ├── client.ts      # Axios client with interceptors
│   │   └── attendance.ts  # Check-in API functions
│   ├── components/        # Reusable components
│   │   ├── ui/           # Basic UI components
│   │   └── scanner/      # Scanner-specific components
│   ├── hooks/            # Custom React hooks
│   ├── store/            # Zustand stores
│   ├── theme/            # Design system
│   │   ├── colors.ts     # Color palette
│   │   ├── typography.ts # Typography styles
│   │   └── spacing.ts    # Spacing & layout
│   ├── types/            # TypeScript types
│   └── utils/            # Utility functions
└── assets/               # Images and fonts
```

## Design System

### Color Palette

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Green | `#136F4E` | Main brand color |
| Gold Accent | `#F4C76C` | Decorative elements |
| Background (Light) | `#F8F5F0` | Warm off-white |
| Background (Dark) | `#020817` | Deep dark |

### Islamic Motifs

- Subtle geometric patterns
- Ayah-style separators
- Corner ornaments inspired by Islamic art
- Arabic typography for microcopy

## API Integration

The app communicates with the backend via REST:

### Check-in Endpoint

```typescript
POST /api/attendance/check-in
Content-Type: application/json
x-device-token: <device-token>
x-device-id: <device-id>

{
  "qrUuid": "student-uuid",
  "scannedAt": "2024-01-01T12:00:00.000Z",
  "deviceId": "device-uuid"
}
```

### Response

```typescript
{
  "success": true,
  "message": "Check-in successful",
  "messageAr": "تم تسجيل الحضور بنجاح",
  "data": {
    "studentName": "Ahmad Muhammad",
    "studentNameAr": "أحمد محمد",
    "sessionName": "حلقة الحفظ",
    "checkedInAt": "2024-01-01T12:00:00.000Z"
  }
}
```

## Arabic Messages

The app includes beautiful Arabic microcopy:

- **Greeting**: السلام عليكم ورحمة الله وبركاته
- **Success**: مرحبًا يا {الاسم} 🌿 - زادك الله حرصًا على كتابه
- **Error**: لم نجد حصة نشطة لك في هذا الوقت

## Future Enhancements

- [ ] Offline mode with local caching
- [ ] Push notifications
- [ ] Teacher authentication
- [ ] Session scheduling view
- [ ] Student profile viewing

## Contributing

This app is developed for جمعية المحافظة على القرآن الكريم (Association for the Preservation of the Holy Quran) in Sfax.

## License

Private - All rights reserved.

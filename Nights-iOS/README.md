# Nights for iOS

This Xcode project is the first native test shell for Nights. It opens the live guest home at `https://gaemaj.tech/nights-guest/`, keeps the signed-in web session on the device, supports the existing file picker, and hands phone, text-message, email, and Maps links to iOS.

## Run on an iPhone

1. Open `Nights-iOS.xcodeproj` in Xcode.
2. Select the **Nights** target, then **Signing & Capabilities**.
3. Choose your Apple development team. Keep the bundle identifier `tech.gaemaj.nights` unless it is already registered to another team.
4. Connect and trust the iPhone, select it as the run destination, and press Run.

Email/password accounts work through the embedded app immediately. The test build uses native Google authentication so account selection and Google passkeys are presented by iOS instead of an isolated web popup.

## Firebase sign-in setup

The Firebase iOS app is registered as `tech.gaemaj.nights`, and its Google client ID and reversed redirect scheme are already configured in the project. Keep the Google provider enabled in Firebase Authentication.

The web app sends the native Google token directly to Firebase Authentication. No Google secret is stored in the app. Sign in with Apple and Associated Domains are intentionally excluded from this free Personal Team test build because Apple does not provision those capabilities for Personal Teams.

APNs push notifications, TestFlight, and App Store distribution still require their corresponding Apple project configuration before release.

import AuthenticationServices
import CryptoKit
import SwiftUI
import UserNotifications
import WebKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

// WKWebView hosts HTML text controls in an internal responder. Returning no
// accessory view from the containing responder suppresses the system form bar
// (previous, next, and Done) while retaining the standard Apple keyboard.
// This uses the public UIResponder API only.
final class NightsChatWebView: WKWebView {
    override var inputAccessoryView: UIView? { nil }
}

@MainActor
final class NightsBrowserModel: ObservableObject {
    @Published var isOffline = false
    @Published var themeColor = UIColor(red: 0.024, green: 0.106, blue: 0.165, alpha: 1)
    fileprivate weak var webView: WKWebView?

    // The app is a native shell around a versioned web release. Keep the
    // release marker in the URL so WKWebView cannot revive a previous HTML
    // shell after an iOS reinstall while its website data is retained.
    fileprivate let startURL = URL(string: "https://gaemaj.tech/nights-guest/?nativeRelease=20261122-10")!

    func reload() {
        isOffline = false
        if let webView {
            webView.reload()
        }
    }
}

struct NightsWebView: UIViewRepresentable {
    @ObservedObject var model: NightsBrowserModel

    func makeCoordinator() -> Coordinator {
        Coordinator(model: model)
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.websiteDataStore = .default()
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.preferences.javaScriptCanOpenWindowsAutomatically = true
        configuration.applicationNameForUserAgent = "Nights-iOS/1.0"
        configuration.userContentController.add(context.coordinator, name: "nightsAuth")
        configuration.userContentController.add(context.coordinator, name: "nightsTheme")
        configuration.userContentController.add(context.coordinator, name: "nightsNotification")
        configuration.userContentController.add(context.coordinator, name: "nightsDatePicker")

        let webView = NightsChatWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.contentInset = .zero
        webView.scrollView.scrollIndicatorInsets = .zero
        webView.scrollView.automaticallyAdjustsScrollIndicatorInsets = false
        webView.scrollView.bounces = false
        webView.scrollView.alwaysBounceVertical = false
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.isDirectionalLockEnabled = true
        webView.scrollView.decelerationRate = .normal
        webView.scrollView.delaysContentTouches = false
        webView.scrollView.canCancelContentTouches = true
        // Nights supplies its own message composer controls. The standard
        // WKWebView input assistant (previous/next arrows and Done button)
        // floats above the keyboard and obscures that composer on iPhone.
        webView.inputAssistantItem.leadingBarButtonGroups = []
        webView.inputAssistantItem.trailingBarButtonGroups = []
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.024, green: 0.106, blue: 0.165, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        context.coordinator.webView = webView
        context.coordinator.beginKeyboardTracking(for: webView)
        model.webView = webView
        webView.load(URLRequest(url: model.startURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nightsAuth")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nightsTheme")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nightsNotification")
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nightsDatePicker")
        coordinator.endKeyboardTracking()
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, UNUserNotificationCenterDelegate,
        ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
        private let model: NightsBrowserModel
        fileprivate weak var webView: WKWebView?
        private var appleNonce: String?
        private var keyboardObservers: [NSObjectProtocol] = []
        private var inputAssistantResetForKeyboard = false

        init(model: NightsBrowserModel) {
            self.model = model
            super.init()
            UNUserNotificationCenter.current().delegate = self
            requestLocalNotificationPermissionIfNeeded()
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isOffline = false
            webView.inputAssistantItem.leadingBarButtonGroups = []
            webView.inputAssistantItem.trailingBarButtonGroups = []
            webView.reloadInputViews()
        }

        func beginKeyboardTracking(for webView: WKWebView) {
            endKeyboardTracking()
            let center = NotificationCenter.default
            keyboardObservers = [
                center.addObserver(forName: UIResponder.keyboardWillChangeFrameNotification, object: nil, queue: .main) { [weak self] notification in
                    self?.publishKeyboardInset(notification, for: webView)
                },
                center.addObserver(forName: UIResponder.keyboardWillHideNotification, object: nil, queue: .main) { [weak self] _ in
                    self?.inputAssistantResetForKeyboard = false
                    self?.publishKeyboardInset(0, for: webView)
                },
            ]
        }

        func endKeyboardTracking() {
            keyboardObservers.forEach(NotificationCenter.default.removeObserver)
            keyboardObservers.removeAll()
        }

        private func publishKeyboardInset(_ notification: Notification, for webView: WKWebView) {
            guard let value = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? NSValue else { return }
            let frame = webView.convert(value.cgRectValue, from: nil)
            publishKeyboardInset(max(0, webView.bounds.maxY - frame.minY), for: webView)
        }

        private func publishKeyboardInset(_ inset: CGFloat, for webView: WKWebView) {
            let value = Int(inset.rounded())
            let active = value > 80 ? "true" : "false"
            // WKWebView can recreate the system previous/next/Done accessory
            // when its HTML textarea becomes first responder. Empty its public
            // UIKit input-assistant groups after that handoff as well as after
            // navigation; this contains no private API and keeps Nights' own
            // composer as the only accessory above the keyboard.
            if value > 80 && !inputAssistantResetForKeyboard {
                inputAssistantResetForKeyboard = true
                DispatchQueue.main.async {
                    webView.inputAssistantItem.leadingBarButtonGroups = []
                    webView.inputAssistantItem.trailingBarButtonGroups = []
                    webView.reloadInputViews()
                }
            }
            webView.evaluateJavaScript("document.documentElement.style.setProperty('--nights-native-keyboard-inset', '\(value)px'); document.body.classList.toggle('chat-keyboard-open', \(active));")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showOfflineIfNeeded(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showOfflineIfNeeded(error)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "nightsTheme", isTrustedAppURL(message.frameInfo.request.url),
               let value = message.body as? String, let color = UIColor(hex: value) {
                model.themeColor = color
                webView?.backgroundColor = color
                webView?.scrollView.backgroundColor = color
                return
            }
            // WebKit may omit the frame URL for a main-frame script message.
            // In that case the loaded web view URL is still the authoritative
            // origin, so do not silently discard a legitimate app notification.
            if message.name == "nightsNotification", isTrustedMessageURL(message.frameInfo.request.url),
               let body = message.body as? [String: Any],
               let title = body["title"] as? String,
               let detail = body["body"] as? String {
                scheduleForegroundNotification(title: title, body: detail, eventId: body["eventId"] as? String ?? "")
                return
            }
            if message.name == "nightsDatePicker", isTrustedMessageURL(message.frameInfo.request.url),
               let body = message.body as? [String: Any],
               let field = body["field"] as? String,
               ["start", "end"].contains(field) {
                showWheelDatePicker(field: field, initialValue: body["value"] as? String)
                return
            }
            guard message.name == "nightsAuth",
                  isTrustedAppURL(message.frameInfo.request.url),
                  let body = message.body as? [String: Any],
                  let provider = body["provider"] as? String else {
                sendNativeAuthError("Nights could not read the sign-in request.")
                return
            }
            if provider == "google" {
                beginGoogleSignIn()
            } else if provider == "apple" {
                beginAppleSignIn()
            } else {
                sendNativeAuthError("That sign-in provider is not supported.")
            }
        }

        func userNotificationCenter(
            _ center: UNUserNotificationCenter,
            willPresent notification: UNNotification,
            withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
        ) {
            completionHandler([.banner, .sound, .badge])
        }

        private func scheduleForegroundNotification(title: String, body: String, eventId: String) {
            let center = UNUserNotificationCenter.current()
            let schedule: () -> Void = {
                let content = UNMutableNotificationContent()
                content.title = title
                content.body = body
                content.sound = .default
                content.userInfo = ["eventId": eventId]
                let request = UNNotificationRequest(
                    identifier: "nights-invitation-\(eventId)-\(UUID().uuidString)",
                    content: content,
                    // A short explicit trigger is more reliable than `nil` for
                    // foreground deliveries in a WKWebView-hosted application.
                    trigger: UNTimeIntervalNotificationTrigger(timeInterval: 0.2, repeats: false)
                )
                center.add(request) { _ in }
            }
            center.getNotificationSettings { settings in
                switch settings.authorizationStatus {
                case .authorized, .provisional, .ephemeral:
                    schedule()
                case .notDetermined:
                    center.requestAuthorization(options: [.alert, .badge, .sound]) { granted, _ in
                        if granted { schedule() }
                    }
                default:
                    break
                }
            }
        }

        private func requestLocalNotificationPermissionIfNeeded() {
            let center = UNUserNotificationCenter.current()
            center.getNotificationSettings { settings in
                guard settings.authorizationStatus == .notDetermined else { return }
                center.requestAuthorization(options: [.alert, .badge, .sound]) { _, _ in }
            }
        }

        func webView(
            _ webView: WKWebView,
            decidePolicyFor navigationAction: WKNavigationAction,
            decisionHandler: @escaping (WKNavigationActionPolicy) -> Void
        ) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.cancel)
                return
            }

            let externallyHandledSchemes = ["tel", "sms", "mailto", "maps"]
            if let scheme = url.scheme?.lowercased(), externallyHandledSchemes.contains(scheme) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        func webView(
            _ webView: WKWebView,
            createWebViewWith configuration: WKWebViewConfiguration,
            for navigationAction: WKNavigationAction,
            windowFeatures: WKWindowFeatures
        ) -> WKWebView? {
            if navigationAction.targetFrame == nil, let url = navigationAction.request.url {
                if let scheme = url.scheme?.lowercased(),
                   ["http", "https", "tel", "sms", "mailto", "maps"].contains(scheme) {
                    UIApplication.shared.open(url)
                } else {
                    webView.load(URLRequest(url: url))
                }
            }
            return nil
        }

        // WKWebView shows nothing for window.alert() and answers "no" to window.confirm()
        // unless the app presents them, so present them as native alerts.
        func webView(
            _ webView: WKWebView,
            runJavaScriptAlertPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping () -> Void
        ) {
            guard let presenter = presentingViewController() else {
                completionHandler()
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
            presenter.present(alert, animated: true)
        }

        func webView(
            _ webView: WKWebView,
            runJavaScriptConfirmPanelWithMessage message: String,
            initiatedByFrame frame: WKFrameInfo,
            completionHandler: @escaping (Bool) -> Void
        ) {
            guard let presenter = presentingViewController() else {
                completionHandler(false)
                return
            }
            let alert = UIAlertController(title: nil, message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) })
            alert.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler(true) })
            presenter.present(alert, animated: true)
        }

        private func isTrustedAppURL(_ url: URL?) -> Bool {
            guard let url, url.scheme == "https" else { return false }
            return url.host == "gaemaj.tech" || url.host == "www.gaemaj.tech"
        }

        private func isTrustedMessageURL(_ frameURL: URL?) -> Bool {
            isTrustedAppURL(frameURL) || isTrustedAppURL(webView?.url)
        }

        private func showOfflineIfNeeded(_ error: Error) {
            let code = (error as NSError).code
            if code != NSURLErrorCancelled {
                model.isOffline = true
            }
        }

        private func beginGoogleSignIn() {
            #if canImport(GoogleSignIn)
            guard let clientID = Bundle.main.object(forInfoDictionaryKey: "GIDClientID") as? String,
                  !clientID.isEmpty else {
                sendNativeAuthError("Google Sign-In needs the iOS client ID from Firebase.")
                return
            }
            guard let presenter = presentingViewController() else {
                sendNativeAuthError("Nights could not open Google Sign-In.")
                return
            }
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { [weak self] result, error in
                guard let self else { return }
                if let error {
                    self.sendNativeAuthError(error.localizedDescription)
                    return
                }
                guard let user = result?.user,
                      let idToken = user.idToken?.tokenString else {
                    self.sendNativeAuthError("Google did not return a usable sign-in credential.")
                    return
                }
                self.callWebAuth("completeGoogle", values: [idToken, user.accessToken.tokenString])
            }
            #else
            sendNativeAuthError("Google Sign-In is not included in this build.")
            #endif
        }

        private func beginAppleSignIn() {
            let nonce = randomNonce()
            appleNonce = nonce
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = sha256(nonce)
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }

        func authorizationController(
            controller: ASAuthorizationController,
            didCompleteWithAuthorization authorization: ASAuthorization
        ) {
            guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
                  let nonce = appleNonce,
                  let tokenData = credential.identityToken,
                  let token = String(data: tokenData, encoding: .utf8) else {
                sendNativeAuthError("Apple did not return a usable sign-in credential.")
                return
            }
            appleNonce = nil
            callWebAuth("completeApple", values: [token, nonce])
        }

        func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
            appleNonce = nil
            sendNativeAuthError(error.localizedDescription)
        }

        func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
            if let window = webView?.window { return window }
            return UIApplication.shared.connectedScenes
                .compactMap { $0 as? UIWindowScene }
                .flatMap(\.windows)
                .first { $0.isKeyWindow } ?? ASPresentationAnchor()
        }

        private func presentingViewController() -> UIViewController? {
            var controller = webView?.window?.rootViewController
            while let presented = controller?.presentedViewController { controller = presented }
            return controller
        }

        private func showWheelDatePicker(field: String, initialValue: String?) {
            guard let presenter = presentingViewController() else { return }
            let sheet = UIViewController()
            sheet.view.backgroundColor = .systemBackground
            sheet.modalPresentationStyle = .pageSheet
            if let presentation = sheet.sheetPresentationController {
                presentation.detents = [.medium()]
                presentation.prefersGrabberVisible = true
            }

            let picker = UIDatePicker()
            picker.datePickerMode = .date
            picker.preferredDatePickerStyle = .wheels
            picker.translatesAutoresizingMaskIntoConstraints = false
            if let initialValue, let date = Self.dayFormatter.date(from: initialValue) {
                picker.date = date
            }

            let cancel = UIButton(type: .system)
            cancel.setTitle("Cancel", for: .normal)
            cancel.titleLabel?.font = .systemFont(ofSize: 17, weight: .semibold)
            let done = UIButton(type: .system)
            done.setTitle("Done", for: .normal)
            done.titleLabel?.font = .systemFont(ofSize: 17, weight: .bold)
            let actions = UIStackView(arrangedSubviews: [cancel, done])
            actions.axis = .horizontal
            actions.distribution = .fillEqually
            actions.spacing = 12
            actions.translatesAutoresizingMaskIntoConstraints = false

            sheet.view.addSubview(picker)
            sheet.view.addSubview(actions)
            NSLayoutConstraint.activate([
                picker.topAnchor.constraint(equalTo: sheet.view.safeAreaLayoutGuide.topAnchor, constant: 8),
                picker.leadingAnchor.constraint(equalTo: sheet.view.leadingAnchor, constant: 16),
                picker.trailingAnchor.constraint(equalTo: sheet.view.trailingAnchor, constant: -16),
                actions.topAnchor.constraint(equalTo: picker.bottomAnchor, constant: 8),
                actions.leadingAnchor.constraint(equalTo: sheet.view.leadingAnchor, constant: 24),
                actions.trailingAnchor.constraint(equalTo: sheet.view.trailingAnchor, constant: -24),
                actions.heightAnchor.constraint(equalToConstant: 48),
                actions.bottomAnchor.constraint(lessThanOrEqualTo: sheet.view.safeAreaLayoutGuide.bottomAnchor, constant: -12),
            ])
            cancel.addAction(UIAction { _ in sheet.dismiss(animated: true) }, for: .touchUpInside)
            done.addAction(UIAction { [weak self, weak sheet, weak picker] _ in
                guard let self, let picker else { return }
                self.sendNativeDate(field: field, value: Self.dayFormatter.string(from: picker.date))
                sheet?.dismiss(animated: true)
            }, for: .touchUpInside)
            presenter.present(sheet, animated: true)
        }

        private func sendNativeDate(field: String, value: String) {
            guard isTrustedAppURL(webView?.url),
                  let data = try? JSONSerialization.data(withJSONObject: ["field": field, "value": value]),
                  let payload = String(data: data, encoding: .utf8) else { return }
            webView?.evaluateJavaScript("window.dispatchEvent(new CustomEvent('nights-native-date-picked', { detail: \(payload) }));")
        }

        private static let dayFormatter: DateFormatter = {
            let formatter = DateFormatter()
            formatter.locale = Locale(identifier: "en_US_POSIX")
            formatter.calendar = Calendar(identifier: .gregorian)
            formatter.dateFormat = "yyyy-MM-dd"
            return formatter
        }()

        private func sendNativeAuthError(_ message: String) {
            callWebAuth("fail", values: [message])
        }

        private func callWebAuth(_ method: String, values: [String]) {
            guard isTrustedAppURL(webView?.url) else { return }
            guard let data = try? JSONSerialization.data(withJSONObject: values),
                  var arguments = String(data: data, encoding: .utf8) else { return }
            arguments.removeFirst()
            arguments.removeLast()
            webView?.evaluateJavaScript("window.__nightsNativeAuth?.\(method)(\(arguments));")
        }

        private func sha256(_ value: String) -> String {
            SHA256.hash(data: Data(value.utf8)).map { String(format: "%02x", $0) }.joined()
        }

        private func randomNonce(length: Int = 32) -> String {
            let characters = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._")
            var result = ""
            var remaining = length
            while remaining > 0 {
                var bytes = [UInt8](repeating: 0, count: 16)
                guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
                    return UUID().uuidString.replacingOccurrences(of: "-", with: "")
                }
                for byte in bytes where remaining > 0 {
                    if byte < characters.count * (256 / characters.count) {
                        result.append(characters[Int(byte) % characters.count])
                        remaining -= 1
                    }
                }
            }
            return result
        }
    }
}

private extension UIColor {
    convenience init?(hex: String) {
        let value = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        guard value.count == 6, let number = Int(value, radix: 16) else { return nil }
        self.init(
            red: CGFloat((number >> 16) & 0xff) / 255,
            green: CGFloat((number >> 8) & 0xff) / 255,
            blue: CGFloat(number & 0xff) / 255,
            alpha: 1
        )
    }
}

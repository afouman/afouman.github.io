import AuthenticationServices
import CryptoKit
import SwiftUI
import WebKit
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@MainActor
final class NightsBrowserModel: ObservableObject {
    @Published var isOffline = false
    fileprivate weak var webView: WKWebView?

    fileprivate let startURL = URL(string: "https://gaemaj.tech/nights-guest/")!

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

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.scrollView.alwaysBounceHorizontal = false
        webView.scrollView.showsHorizontalScrollIndicator = false
        webView.scrollView.isDirectionalLockEnabled = true
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.024, green: 0.106, blue: 0.165, alpha: 1)
        webView.scrollView.backgroundColor = webView.backgroundColor
        context.coordinator.webView = webView
        model.webView = webView
        webView.load(URLRequest(url: model.startURL, cachePolicy: .useProtocolCachePolicy))
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    static func dismantleUIView(_ webView: WKWebView, coordinator: Coordinator) {
        webView.configuration.userContentController.removeScriptMessageHandler(forName: "nightsAuth")
    }

    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler,
        ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
        private let model: NightsBrowserModel
        fileprivate weak var webView: WKWebView?
        private var appleNonce: String?

        init(model: NightsBrowserModel) {
            self.model = model
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            model.isOffline = false
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            showOfflineIfNeeded(error)
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            showOfflineIfNeeded(error)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
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
                   ["tel", "sms", "mailto", "maps"].contains(scheme) {
                    UIApplication.shared.open(url)
                } else {
                    webView.load(URLRequest(url: url))
                }
            }
            return nil
        }

        private func isTrustedAppURL(_ url: URL?) -> Bool {
            guard let url, url.scheme == "https" else { return false }
            return url.host == "gaemaj.tech" || url.host == "www.gaemaj.tech"
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

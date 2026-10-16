import SwiftUI
#if canImport(GoogleSignIn)
import GoogleSignIn
#endif

@main
struct NightsApp: App {
    var body: some Scene {
        WindowGroup {
            NightsRootView()
                .tint(Color(red: 0.08, green: 0.49, blue: 0.46))
                .onOpenURL { url in
                    #if canImport(GoogleSignIn)
                    _ = GIDSignIn.sharedInstance.handle(url)
                    #endif
                }
        }
    }
}

private struct NightsRootView: View {
    @StateObject private var browser = NightsBrowserModel()

    var body: some View {
        ZStack {
            Color(red: 0.024, green: 0.106, blue: 0.165)
                .ignoresSafeArea()

            NightsWebView(model: browser)
                .ignoresSafeArea(.container, edges: .all)

            if browser.isOffline {
                VStack(spacing: 16) {
                    Image(systemName: "wifi.slash")
                        .font(.system(size: 34, weight: .semibold))
                    Text("Nights is offline")
                        .font(.title2.weight(.bold))
                    Text("Check your connection, then try again. Your account and event data are safe.")
                        .multilineTextAlignment(.center)
                        .foregroundStyle(.secondary)
                    Button("Try again") {
                        browser.reload()
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)
                }
                .padding(28)
                .frame(maxWidth: 360)
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 28, style: .continuous))
                .padding(24)
            }
        }
        .preferredColorScheme(nil)
    }
}

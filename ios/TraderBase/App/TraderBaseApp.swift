import SwiftUI

@main
struct TraderBaseApp: App {
    @StateObject private var authManager = AuthManager()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(authManager)
        }
    }
}

struct RootView: View {
    @EnvironmentObject var authManager: AuthManager

    var body: some View {
        Group {
            if authManager.isLoading {
                LoadingView()
            } else if authManager.isAuthenticated {
                MainTabView()
            } else {
                LoginView()
            }
        }
        .onAppear {
            authManager.checkSession()
        }
    }
}

struct LoadingView: View {
    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 16) {
                ProgressView()
                    .progressViewStyle(CircularProgressViewStyle(tint: Color(hex: "32FF48")))
                    .scaleEffect(1.5)
                Text("Loading...")
                    .font(.system(.body, design: .default, weight: .medium))
                    .foregroundColor(.white.opacity(0.6))
            }
        }
    }
}

import Foundation
import Supabase

@MainActor
class AuthManager: ObservableObject {
    @Published var currentUser: User?
    @Published var isAuthenticated = false
    @Published var isLoading = true

    private let client = SupabaseClientManager.shared.client

    func checkSession() {
        Task {
            do {
                let session = try await client.auth.session
                if session != nil {
                    self.isAuthenticated = true
                    await fetchCurrentUser()
                }
            } catch {
                self.isAuthenticated = false
            }
            self.isLoading = false
        }
    }

    func signInWithEmail(email: String) async throws {
        // Magic link sign-in
        try await client.auth.signInWithOTP(
            email: email,
            options: EmailOTPOptions(
                emailRedirectTo: URL(string: "traderbase://login-callback")
            )
        )
    }

    func signInWithGoogle() async throws {
        // Google OAuth — opens ASWebAuthenticationSession on iOS
        try await client.auth.signInWithSSO(
            provider: .google,
            redirectURL: "traderbase://login-callback"
        )
    }

    func fetchCurrentUser() async {
        do {
            let response: User = try await client.database
                .from("users")
                .select()
                .eq("id", client.auth.currentUserId ?? "")
                .single()
                .decode()
            self.currentUser = response
        } catch {
            print("Failed to fetch user: \(error)")
        }
    }

    func signOut() async {
        do {
            try await client.auth.signOut()
            self.currentUser = nil
            self.isAuthenticated = false
        } catch {
            print("Sign out error: \(error)")
        }
    }
}

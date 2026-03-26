import Foundation
import Supabase

enum SupabaseConfig {
    // TODO: Replace with real values when credentials are ready
    static let supabaseURL = URL(string: "https://placeholder.supabase.co")!
    static let supabaseAnonKey = "placeholder_anon_key"
}

@MainActor
class SupabaseClientManager: ObservableObject {
    static let shared = SupabaseClientManager()

    let client: SupabaseClient

    private init() {
        self.client = SupabaseClient(
            supabaseURL: SupabaseConfig.supabaseURL,
            supabaseKey: SupabaseConfig.supabaseAnonKey,
            options: SupabaseClientOptions(
                auth: AuthClientOptions(
                    autoRefreshToken: true,
                    persistSession: true,
                    storage: WebStorageManager()
                )
            )
        )
    }
}

// MARK: - WebStorageManager (uses UserDefaults instead of Keychain for simplicity)
class WebStorageManager: StorageDriver {
    private let userDefaults = UserDefaults.standard
    private let key = "supabase.auth.token"

    func save(key: String, value: String) throws {
        userDefaults.set(value, forKey: key)
    }

    func retrieve(key: String) throws -> String? {
        return userDefaults.string(forKey: key)
    }

    func remove(key: String) throws {
        userDefaults.removeObject(forKey: key)
    }
}

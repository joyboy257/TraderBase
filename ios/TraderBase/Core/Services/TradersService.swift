import Foundation
import Supabase

class TradersService {
    private let client = SupabaseClientManager.shared.client

    // MARK: - Fetch Trader Profiles
    func fetchTraders(limit: Int = 50) async throws -> [PublicProfile] {
        let response = try await client.database
            .from("users")
            .select()
            .eq("is_trader", true)
            .limit(limit)
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([PublicProfile].self, from: response.data)
    }

    // MARK: - Fetch Single Trader
    func fetchTrader(username: String) async throws -> PublicProfile? {
        let response = try await client.database
            .from("users")
            .select()
            .eq("username", username)
            .single()
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(PublicProfile.self, from: response.data)
    }
}

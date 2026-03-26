import Foundation
import Supabase

class PortfolioService {
    private let client = SupabaseClientManager.shared.client

    // MARK: - Fetch Positions
    func fetchPositions() async throws -> [Position] {
        guard let userId = client.auth.currentUserId else { return [] }

        let response = try await client.database
            .from("positions")
            .select()
            .eq("user_id", userId)
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([Position].self, from: response.data)
    }

    // MARK: - Fetch Recent Trades
    func fetchRecentTrades(limit: Int = 20) async throws -> [Trade] {
        guard let userId = client.auth.currentUserId else { return [] }

        let response = try await client.database
            .from("trades")
            .select()
            .eq("user_id", userId)
            .order("executed_at", ascending: false)
            .limit(limit)
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([Trade].self, from: response.data)
    }

    // MARK: - Fetch Copied Trades
    func fetchCopiedTrades(limit: Int = 20) async throws -> [CopiedTrade] {
        guard let userId = client.auth.currentUserId else { return [] }

        let response = try await client.database
            .from("copied_trades")
            .select()
            .eq("user_id", userId)
            .order("executed_at", ascending: false)
            .limit(limit)
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([CopiedTrade].self, from: response.data)
    }
}

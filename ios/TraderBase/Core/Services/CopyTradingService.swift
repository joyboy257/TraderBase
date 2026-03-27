import Foundation
import Supabase

// MARK: - Copy Trade Result
struct CopyTradeResult: Codable {
    let success: Bool
    let copiedTradeId: String?
    let error: String?

    enum CodingKeys: String, CodingKey {
        case success
        case copiedTradeId = "copied_trade_id"
        case error
    }
}

class CopyTradingService {
    private let client = SupabaseClientManager.shared.client

    // MARK: - Follow / Unfollow
    func followTrader(leaderId: String, copyRatio: Double = 1.0, maxPositionSize: Double = 1000) async throws {
        guard let followerId = client.auth.currentUserId else {
            throw NSError(domain: "AuthError", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }

        let payload: [String: Any] = [
            "follower_id": followerId,
            "leader_id": leaderId,
            "copy_ratio": copyRatio,
            "max_position_size": maxPositionSize,
            "is_active": true
        ]

        try await client.database
            .from("follows")
            .insert(payload)
            .execute()
    }

    func unfollowTrader(leaderId: String) async throws {
        guard let followerId = client.auth.currentUserId else { return }

        try await client.database
            .from("follows")
            .update(["is_active": false])
            .eq("follower_id", followerId)
            .eq("leader_id", leaderId)
            .execute()
    }

    // MARK: - Check If Following
    func isFollowing(leaderId: String) async -> Bool {
        guard let followerId = client.auth.currentUserId else { return false }

        do {
            let response = try await client.database
                .from("follows")
                .select("id")
                .eq("follower_id", followerId)
                .eq("leader_id", leaderId)
                .eq("is_active", true)
                .limit(1)
                .execute()

            return !response.data.isEmpty
        } catch {
            return false
        }
    }

    // MARK: - Copy Signal
    func copySignal(signalId: String) async throws -> CopyTradeResult {
        guard let accessToken = client.auth.session?.accessToken else {
            throw NSError(domain: "AuthError", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }

        let url = URL(string: "\(SupabaseConfig.appURL)/api/copy-trade")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(accessToken)", forHTTPHeaderField: "Authorization")

        let body = ["signalId": signalId]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw NSError(domain: "NetworkError", code: -1, userInfo: [NSLocalizedDescriptionKey: "Invalid response"])
        }

        if httpResponse.statusCode == 401 {
            throw NSError(domain: "AuthError", code: 401, userInfo: [NSLocalizedDescriptionKey: "Unauthorized"])
        }

        let decoder = JSONDecoder()
        let result = try decoder.decode(CopyTradeResult.self, from: data)
        return result
    }

    // MARK: - Fetch Followed Traders
    func fetchFollowedTraders() async throws -> [PublicProfile] {
        guard let userId = client.auth.currentUserId else { return [] }

        let response = try await client.database
            .from("follows")
            .select("leader:leader_id(*)")
            .eq("follower_id", userId)
            .eq("is_active", true)
            .execute()

        // Parse the nested response
        struct FollowRow: Decodable {
            let leader: PublicProfile?
        }
        let decoder = JSONDecoder()
        let rows = try decoder.decode([FollowRow].self, from: response.data)
        return rows.compactMap { $0.leader }
    }
}

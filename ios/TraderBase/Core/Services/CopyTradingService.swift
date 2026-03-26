import Foundation
import Supabase

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
    func copySignal(signalId: String) async throws -> Bool {
        // Calls the server action — in a real app this would be a Supabase Edge Function
        // For now we call the same logic the web app uses
        let url = URL(string: "\(SupabaseConfig.supabaseURL)/functions/v1/copy-trade")!
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(try await client.auth.session?.accessToken ?? "")", forHTTPHeaderField: "Authorization")

        let body = ["signal_id": signalId]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else { return false }
        return httpResponse.statusCode == 200
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

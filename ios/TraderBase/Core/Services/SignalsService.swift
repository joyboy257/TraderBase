import Foundation
import Supabase

class SignalsService {
    private let client = SupabaseClientManager.shared.client

    // MARK: - Fetch Signals Feed
    func fetchSignals(ticker: String? = nil, action: SignalAction? = nil, limit: Int = 50) async throws -> [SignalWithTrader] {
        var query = client.database
            .from("signals")
            .select("*, users(*)")
            .eq("is_active", true)
            .order("created_at", ascending: false)
            .limit(limit)

        if let ticker = ticker, !ticker.isEmpty {
            query = query.eq("ticker", value: ticker.uppercased())
        }
        if let action = action {
            query = query.eq("action", value: action.rawValue)
        }

        let response = try await query.execute()
        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601

        return response.value as? [SignalWithTrader] ?? []
    }

    // MARK: - Fetch Trader's Signals
    func fetchTraderSignals(userId: String) async throws -> [Signal] {
        let response = try await client.database
            .from("signals")
            .select()
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at", ascending: false)
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode([Signal].self, from: response.data)
    }

    // MARK: - Create Signal
    func createSignal(ticker: String, action: SignalAction, entryPrice: Double, stopLoss: Double?, takeProfit: Double?, rationale: String?) async throws -> Signal {
        guard let userId = SupabaseClientManager.shared.client.auth.currentUserId else {
            throw NSError(domain: "AuthError", code: 401, userInfo: [NSLocalizedDescriptionKey: "Not authenticated"])
        }

        let payload: [String: Any] = [
            "user_id": userId,
            "ticker": ticker.uppercased(),
            "action": action.rawValue,
            "entry_price": entryPrice,
            "stop_loss": stopLoss as Any,
            "take_profit": takeProfit as Any,
            "rationale": rationale as Any,
            "is_active": true,
            "is_verified": false
        ]

        let response = try await client.database
            .from("signals")
            .insert(payload)
            .select()
            .single()
            .execute()

        let decoder = JSONDecoder()
        decoder.dateDecodingStrategy = .iso8601
        return try decoder.decode(Signal.self, from: response.data)
    }

    // MARK: - Toggle Signal Active
    func toggleSignal(signalId: String, isActive: Bool) async throws {
        try await client.database
            .from("signals")
            .update(["is_active": isActive])
            .eq("id", signalId)
            .execute()
    }
}

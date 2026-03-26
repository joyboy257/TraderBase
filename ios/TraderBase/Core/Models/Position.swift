import Foundation

struct Position: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    let ticker: String
    let quantity: Double
    let averageCost: Double
    var currentPrice: Double
    var unrealizedPnl: Double
    var unrealizedPnlPct: Double
    let accountId: String?

    enum CodingKeys: String, CodingKey {
        case id, ticker, quantity
        case userId = "user_id"
        case averageCost = "average_cost"
        case currentPrice = "current_price"
        case unrealizedPnl = "unrealized_pnl"
        case unrealizedPnlPct = "unrealized_pnl_pct"
        case accountId = "account_id"
    }
}

struct TickerPrice: Identifiable, Hashable {
    var id: String { ticker }
    let ticker: String
    let price: Double
    let change: Double
    let changePercent: Double
}

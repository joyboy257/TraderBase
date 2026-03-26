import Foundation

struct Signal: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    let ticker: String
    let action: SignalAction
    let entryPrice: Double
    var stopLoss: Double?
    var takeProfit: Double?
    var rationale: String?
    var isActive: Bool
    var isVerified: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id, ticker, action, rationale
        case userId = "user_id"
        case entryPrice = "entry_price"
        case stopLoss = "stop_loss"
        case takeProfit = "take_profit"
        case isActive = "is_active"
        case isVerified = "is_verified"
        case createdAt = "created_at"
    }
}

enum SignalAction: String, Codable, Hashable {
    case BUY
    case SELL

    var color: String {
        switch self {
        case .BUY: return "32FF48"
        case .SELL: return "FF4757"
        }
    }
}

struct SignalWithTrader: Identifiable, Hashable {
    let signal: Signal
    let trader: PublicProfile
}

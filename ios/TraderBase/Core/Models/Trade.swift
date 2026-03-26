import Foundation

struct Trade: Identifiable, Codable, Hashable {
    let id: String
    let userId: String
    let ticker: String
    let action: SignalAction
    let quantity: Double
    let price: Double
    let executedAt: Date
    let signalId: String?

    enum CodingKeys: String, CodingKey {
        case id, ticker, action, quantity, price
        case userId = "user_id"
        case executedAt = "executed_at"
        case signalId = "signal_id"
    }
}

struct CopiedTrade: Identifiable, Codable {
    let id: String
    let userId: String
    let signalId: String
    let brokerageConnectionId: String
    let ticker: String
    let action: SignalAction
    let quantity: Double
    let price: Double
    let executedAt: Date
    let status: CopiedTradeStatus
    let errorMessage: String?

    enum CodingKeys: String, CodingKey {
        case id, ticker, action, quantity, price, status
        case userId = "user_id"
        case signalId = "signal_id"
        case brokerageConnectionId = "brokerage_connection_id"
        case executedAt = "executed_at"
        case errorMessage = "error_message"
    }
}

enum CopiedTradeStatus: String, Codable {
    case pending
    case executed
    case failed
}

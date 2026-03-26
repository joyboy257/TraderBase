import Foundation

struct User: Identifiable, Codable, Hashable {
    let id: String
    var email: String?
    var username: String?
    var displayName: String?
    var avatarUrl: String?
    var bio: String?
    var isTrader: Bool
    var isVerified: Bool
    var createdAt: Date?

    enum CodingKeys: String, CodingKey {
        case id, email, username, bio
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case isTrader = "is_trader"
        case isVerified = "is_verified"
        case createdAt = "created_at"
    }
}

struct PublicProfile: Identifiable, Hashable {
    let id: String
    let username: String
    let displayName: String
    let avatarUrl: String?
    let bio: String?
    let isTrader: Bool
    let isVerified: Bool
    let returnPct: Double?
    let winRate: Double?
    let followersCount: Int
    let signalsCount: Int

    enum CodingKeys: String, CodingKey {
        case id, username, bio
        case displayName = "display_name"
        case avatarUrl = "avatar_url"
        case isTrader = "is_trader"
        case isVerified = "is_verified"
        case returnPct = "return_pct"
        case winRate = "win_rate"
        case followersCount = "followers_count"
        case signalsCount = "signals_count"
    }
}

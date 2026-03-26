import Foundation

struct Follow: Identifiable, Codable, Hashable {
    let id: String
    let followerId: String
    let leaderId: String
    var copyRatio: Double
    var maxPositionSize: Double
    var isActive: Bool
    let createdAt: Date

    enum CodingKeys: String, CodingKey {
        case id
        case followerId = "follower_id"
        case leaderId = "leader_id"
        case copyRatio = "copy_ratio"
        case maxPositionSize = "max_position_size"
        case isActive = "is_active"
        case createdAt = "created_at"
    }
}

struct ChatMessage: Identifiable, Codable, Hashable {
    let id: String
    let roomId: String
    let userId: String
    let content: String
    let createdAt: Date
    var trader: PublicProfile?

    enum CodingKeys: String, CodingKey {
        case id, content
        case roomId = "room_id"
        case userId = "user_id"
        case createdAt = "created_at"
        case trader
    }
}
